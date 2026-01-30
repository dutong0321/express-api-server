const express = require('express');
const cors = require('cors');
const path = require('path');
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
});
