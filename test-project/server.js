const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from x86 app!', arch: process.arch });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
