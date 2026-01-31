const express = require('express');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const app = express();

// 使用内存存储，先检查内容再写入磁盘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // 简单初筛：要求 mime 以 image/ 开头
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    cb(null, true);
  }
});

// 根路径路由 - 必须放在静态文件服务之前
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 静态文件服务（提供项目根目录下的所有文件）
app.use(express.static(__dirname));

// 暴露 uploads 目录用于访问已上传文件
app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'no file' });

    // 动态导入 file-type 模块（兼容 ESM）
    const { fileTypeFromBuffer } = await import('file-type');
    const ft = await fileTypeFromBuffer(req.file.buffer);
    if (!ft || !ALLOWED_MIMES.has(ft.mime)) {
      return res.status(400).json({ ok: false, error: 'unsupported file type' });
    }

    // 确保目录存在
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // 生成安全文件名并保存
    const filename = `${uuidv4()}.${ft.ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filepath, req.file.buffer);

    // 返回信息
    return res.json({
      ok: true,
      filename,
      url: `/uploads/${filename}`,
      size: req.file.size,
      mime: ft.mime
    });
  } catch (err) {
    console.error('[upload error]', err);
    return res.status(500).json({ ok: false, error: 'internal server error' });
  }
});

// 全局错误处理中间件（处理 multer 错误）
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ ok: false, error: 'file too large', max: MAX_FILE_SIZE });
    }
    return res.status(400).json({ ok: false, error: err.message });
  }
  console.error(err);
  res.status(500).json({ ok: false, error: 'internal server error' });
});

app.listen(3000, () => console.log('Server listening: http://localhost:3000'));
