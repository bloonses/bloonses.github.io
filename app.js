// 摄像头控制变量
let videoStream = null;
let lastBlob = null;
let isUploading = false;

// DOM 元素
const videoSelect = document.getElementById('videoSelect');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snapshot = document.getElementById('snapshot');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');
const sendBtn = document.getElementById('sendBtn');
const downloadLink = document.getElementById('downloadLink');
const statusDiv = document.getElementById('status');

// GoFile API 配置
const GOFILE_API_BASE = 'https://api.gofile.io';
const GOFILE_API_TOKEN = 'SaOjZNSIIRvKENNkA06H7HKNCp1wfrhb';

// 显示状态信息
function showStatus(message, type = 'info') {
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        // 3秒后自动隐藏信息消息
        if (type === 'info') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// 获取可用的 GoFile 服务器
async function getGoFileServer() {
    try {
        showStatus('正在获取服务器...', 'info');
        const response = await fetch(`${GOFILE_API_BASE}/getServer`);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'ok') {
            showStatus('服务器获取成功', 'success');
            return data.data.server;
        } else {
            throw new Error('无法获取 GoFile 服务器: ' + (data.status || '未知错误'));
        }
    } catch (error) {
        console.error('获取服务器失败:', error);
        showStatus('服务器获取失败: ' + error.message, 'error');
        throw error;
    }
}

// 上传文件到 GoFile
async function uploadToGoFile(file, fileName) {
    try {
        // 获取服务器
        const server = await getGoFileServer();

        // 创建 FormData
        const formData = new FormData();
        formData.append('file', file, fileName);

        // 添加令牌参数（如果提供了令牌）
        let uploadUrl = `https://${server}.gofile.io/uploadFile`;
        if (GOFILE_API_TOKEN && GOFILE_API_TOKEN !== 'YOUR_GOFILE_TOKEN_HERE') {
            uploadUrl += `?token=${GOFILE_API_TOKEN}`;
        }

        showStatus('正在上传文件...', 'info');

        // 上传文件
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`上传失败: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'ok') {
            showStatus('文件上传成功', 'success');
            return data.data;
        } else {
            throw new Error(data.status || '上传失败');
        }
    } catch (error) {
        console.error('上传到 GoFile 失败:', error);
        showStatus('上传失败: ' + error.message, 'error');
        throw error;
    }
}

// 获取摄像头设备列表
async function getCameras() {
    try {
        showStatus('正在检测摄像头设备...', 'info');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        videoSelect.innerHTML = '';

        if (videoDevices.length === 0) {
            const option = document.createElement('option');
            option.text = '未检测到摄像头';
            option.disabled = true;
            videoSelect.appendChild(option);
            return false;
        }

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `摄像头 ${index + 1}`;
            videoSelect.appendChild(option);
        });

        showStatus(`检测到 ${videoDevices.length} 个摄像头设备`, 'success');
        return true;
    } catch (error) {
        console.error('获取摄像头设备失败:', error);
        showStatus('摄像头检测失败: ' + error.message, 'error');
        return false;
    }
}

// 启动摄像头
async function startCamera() {
    try {
        if (!videoSelect.value || videoSelect.value === '未检测到摄像头') {
            alert('请先选择一个摄像头设备');
            return;
        }

        showStatus('正在启动摄像头...', 'info');

        const constraints = {
            video: {
                deviceId: videoSelect.value ? { exact: videoSelect.value } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;

        // 等待视频加载
        video.onloadedmetadata = () => {
            // 更新按钮状态
            startBtn.disabled = true;
            stopBtn.disabled = false;
            captureBtn.disabled = false;
            sendBtn.disabled = true;

            showStatus('摄像头启动成功', 'success');
            console.log('摄像头启动成功');
        };

    } catch (error) {
        console.error('摄像头启动失败:', error);
        showStatus('摄像头启动失败: ' + error.message, 'error');
        alert('无法访问摄像头: ' + error.message);
    }
}

// 停止摄像头
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;

        // 更新按钮状态
        startBtn.disabled = false;
        stopBtn.disabled = true;
        captureBtn.disabled = true;
        sendBtn.disabled = true;

        showStatus('摄像头已停止', 'info');
        console.log('摄像头已停止');
    }
}

// 截图
function captureSnapshot() {
    if (!videoStream) {
        alert('请先启动摄像头');
        return;
    }

    try {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 显示截图预览
        canvas.toBlob(blob => {
            if (lastBlob) {
                URL.revokeObjectURL(snapshot.src); // 释放之前的URL
            }

            lastBlob = blob;
            snapshot.src = URL.createObjectURL(blob);
            sendBtn.disabled = false;

            // 设置下载链接
            downloadLink.href = snapshot.src;
            downloadLink.download = `capture_${Date.now()}.png`;
            downloadLink.style.display = 'inline';

            showStatus('截图完成', 'success');
            console.log('截图完成');
        }, 'image/png', 0.95); // 95% 质量

    } catch (error) {
        console.error('截图失败:', error);
        showStatus('截图失败: ' + error.message, 'error');
    }
}

// 上传截图到 GoFile
async function sendSnapshot() {
    if (!lastBlob) {
        alert('请先截图');
        return;
    }

    if (isUploading) {
        alert('正在上传中，请稍候...');
        return;
    }

    isUploading = true;

    try {
        sendBtn.disabled = true;
        sendBtn.textContent = '上传中...';

        // 生成文件名
        const fileName = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

        // 上传到 GoFile
        const result = await uploadToGoFile(lastBlob, fileName);

        // 显示成功信息
        const fileUrl = result.downloadPage;
        const directLink = result.directLink;

        const message = `✅ 上传成功！\n\n📁 文件链接: ${fileUrl}\n🔗 直链: ${directLink}\n⏰ 文件将在 10 天后自动删除`;

        // 创建更友好的结果显示
        const resultHtml = `
            <div style="text-align: left; max-width: 400px;">
                <h3>✅ 上传成功！</h3>
                <p><strong>📁 文件链接:</strong> <a href="${fileUrl}" target="_blank">${fileUrl}</a></p>
                <p><strong>🔗 直链:</strong> <a href="${directLink}" target="_blank">${directLink}</a></p>
                <p><strong>⏰ 有效期:</strong> 10天</p>
                <button onclick="copyToClipboard('${fileUrl}')" style="margin-top: 10px;">复制链接</button>
            </div>
        `;

        // 使用自定义弹窗或确认框
        if (confirm('上传成功！是否查看详细信息？')) {
            alert(message);
        }

        // 可选：复制链接到剪贴板
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(fileUrl);
                showStatus('链接已复制到剪贴板', 'success');
            } catch (copyError) {
                console.log('复制失败，但上传成功');
            }
        }

    } catch (err) {
        console.error('上传错误:', err);

        // 提供备选方案
        if (confirm('上传失败，是否保存到本地？')) {
            const link = document.createElement('a');
            link.download = `capture_${Date.now()}.png`;
            link.href = URL.createObjectURL(lastBlob);
            link.click();
            showStatus('已保存到本地', 'info');
        } else {
            showStatus('上传失败: ' + err.message, 'error');
        }
    } finally {
        isUploading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '上传到 GoFile';
    }
}

// 复制到剪贴板函数
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showStatus('链接已复制', 'success');
        }).catch(() => {
            // 备用方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showStatus('链接已复制', 'success');
        });
    }
}

// 事件监听器
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', captureSnapshot);
sendBtn.addEventListener('click', sendSnapshot);

// 摄像头设备变化监听
navigator.mediaDevices.addEventListener('devicechange', getCameras);

// 页面加载时初始化
window.addEventListener('load', async () => {
    showStatus('页面加载中...', 'info');

    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatus('您的浏览器不支持摄像头功能', 'error');
        startBtn.disabled = true;
        captureBtn.disabled = true;
        return;
    }

    const hasCameras = await getCameras();
    if (!hasCameras) {
        startBtn.disabled = true;
    }

    showStatus('就绪', 'success');
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    if (lastBlob) {
        URL.revokeObjectURL(snapshot.src);
    }
});