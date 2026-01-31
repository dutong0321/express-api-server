const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let users = [
  { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com' },
  { id: 2, name: '李四', age: 30, email: 'lisi@example.com' },
  { id: 3, name: '王五', age: 28, email: 'wangwu@example.com' }
];

let messages = [];

// URL监控配置和记录
let urlMonitors = [];
// 存储每个URL的最近10条访问记录
let urlRecords = new Map(); // key: urlId, value: [{timestamp, statusCode, response}]
// 存储定时任务引用
let monitorIntervals = new Map(); // key: urlId, value: intervalId

app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    data: users,
    total: users.length
  });
});

app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  res.json({ success: true, data: user });
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: users.length + 1,
    name: req.body.name,
    age: req.body.age,
    email: req.body.email
  };
  users.push(newUser);
  res.json({ success: true, message: '用户创建成功', data: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  user.name = req.body.name || user.name;
  user.age = req.body.age || user.age;
  user.email = req.body.email || user.email;
  res.json({ success: true, message: '用户更新成功', data: user });
});

app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  users.splice(index, 1);
  res.json({ success: true, message: '用户删除成功' });
});

app.get('/api/messages', (req, res) => {
  res.json({
    success: true,
    data: messages
  });
});

app.post('/api/messages', (req, res) => {
  const newMessage = {
    id: messages.length + 1,
    content: req.body.content,
    createdAt: new Date().toISOString()
  };
  messages.push(newMessage);
  res.json({ success: true, message: '留言创建成功', data: newMessage });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      userCount: users.length,
      messageCount: messages.length,
      server: 'Express',
      timestamp: new Date().toISOString()
    }
  });
});

// 访问URL的函数
function visitUrl(urlString) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlString);
      const client = url.protocol === 'https:' ? https : http;
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: 30000
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            response: data.substring(0, 500)
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 0,
          response: `Error: ${error.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          statusCode: 0,
          response: 'Error: Request timeout'
        });
      });

      req.end();
    } catch (error) {
      resolve({
        statusCode: 0,
        response: `Error: ${error.message}`
      });
    }
  });
}

// 执行URL监控任务
async function executeMonitor(monitorId) {
  const monitor = urlMonitors.find(m => m.id === monitorId);
  if (!monitor) return;

  const result = await visitUrl(monitor.url);
  const record = {
    timestamp: new Date().toISOString(),
    statusCode: result.statusCode,
    response: result.response
  };

  // 获取现有记录
  let records = urlRecords.get(monitorId) || [];
  // 添加新记录到开头
  records.unshift(record);
  // 只保留最近10条
  records = records.slice(0, 10);
  urlRecords.set(monitorId, records);

  console.log(`[Monitor ${monitorId}] ${monitor.url} - Status: ${result.statusCode} - ${new Date().toLocaleString()}`);
}

// 启动URL监控定时任务
function startMonitor(monitor) {
  // 先停止已有的定时任务
  stopMonitor(monitor.id);

  // 计算随机间隔时间（毫秒）
  const minInterval = monitor.minInterval * 1000;
  const maxInterval = monitor.maxInterval * 1000;

  // 立即执行一次
  executeMonitor(monitor.id);

  // 设置定时任务
  const scheduleNext = () => {
    const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
    const timeoutId = setTimeout(async () => {
      await executeMonitor(monitor.id);
      if (monitorIntervals.has(monitor.id)) {
        scheduleNext();
      }
    }, randomInterval);
    monitorIntervals.set(monitor.id, timeoutId);
  };

  scheduleNext();
}

// 停止URL监控定时任务
function stopMonitor(monitorId) {
  const intervalId = monitorIntervals.get(monitorId);
  if (intervalId) {
    clearTimeout(intervalId);
    monitorIntervals.delete(monitorId);
  }
}

// 获取URL监控列表
app.get('/api/url-monitors', (req, res) => {
  const monitorsWithRecords = urlMonitors.map(monitor => ({
    ...monitor,
    records: urlRecords.get(monitor.id) || []
  }));

  res.json({
    success: true,
    data: monitorsWithRecords,
    total: urlMonitors.length
  });
});

// 创建URL监控
app.post('/api/url-monitors', (req, res) => {
  const { url, minInterval, maxInterval } = req.body;

  if (!url || !minInterval || !maxInterval) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: url, minInterval, maxInterval'
    });
  }

  if (minInterval > maxInterval) {
    return res.status(400).json({
      success: false,
      message: '最小间隔不能大于最大间隔'
    });
  }

  const newMonitor = {
    id: Date.now(),
    url,
    minInterval: parseInt(minInterval),
    maxInterval: parseInt(maxInterval),
    createdAt: new Date().toISOString()
  };

  urlMonitors.push(newMonitor);
  urlRecords.set(newMonitor.id, []);

  // 启动定时任务
  startMonitor(newMonitor);

  res.json({
    success: true,
    message: 'URL监控创建成功',
    data: newMonitor
  });
});

// 删除URL监控
app.delete('/api/url-monitors/:id', (req, res) => {
  const monitorId = parseInt(req.params.id);
  const index = urlMonitors.findIndex(m => m.id === monitorId);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: '监控配置不存在'
    });
  }

  // 停止定时任务
  stopMonitor(monitorId);

  // 删除记录
  urlRecords.delete(monitorId);

  // 删除配置
  urlMonitors.splice(index, 1);

  res.json({
    success: true,
    message: 'URL监控删除成功'
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`🌐 前端页面: http://localhost:${PORT}`);
  console.log(`📚 API 测试地址:`);
  console.log(`   - 获取所有用户: GET http://localhost:${PORT}/api/users`);
  console.log(`   - 获取单个用户: GET http://localhost:${PORT}/api/users/1`);
  console.log(`   - 创建用户: POST http://localhost:${PORT}/api/users`);
  console.log(`   - 获取留言: GET http://localhost:${PORT}/api/messages`);
  console.log(`   - 发送留言: POST http://localhost:${PORT}/api/messages`);
  console.log(`   - 统计数据: GET http://localhost:${PORT}/api/stats`);
  console.log(`   - 获取URL监控列表: GET http://localhost:${PORT}/api/url-monitors`);
  console.log(`   - 创建URL监控: POST http://localhost:${PORT}/api/url-monitors`);
  console.log(`   - 删除URL监控: DELETE http://localhost:${PORT}/api/url-monitors/:id`);
});
