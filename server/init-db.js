const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'tracker.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// 读取 schema.sql
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log('正在初始化数据库...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('打开数据库失败:', err);
    process.exit(1);
  }
  console.log('已连接到数据库');
});

// 执行 schema
db.exec(schema, (err) => {
  if (err) {
    console.error('执行 schema 失败:', err);
    db.close();
    process.exit(1);
  }
  console.log('数据库初始化完成！');
  console.log(`数据库文件位置: ${dbPath}`);
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err);
    } else {
      console.log('数据库已关闭');
    }
    process.exit(0);
  });
});
