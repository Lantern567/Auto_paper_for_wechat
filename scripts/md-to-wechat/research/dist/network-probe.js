"use strict";
/**
 * mdnice 网络请求探测脚本
 * 用于分析 mdnice.com 的网络请求，查找可能的 API 接口
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var playwright_1 = require("playwright");
var fs = require("fs");
var path = require("path");
var MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
var OUTPUT_DIR = path.join(__dirname, 'output');
var networkRequests = [];
function probe() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, context, page, closeButton, e_1, driverOverlay, e_2, testMarkdown, previewHTML, htmlPath, pageInfo, requestsPath, apiRequests, postRequests, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    browser = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 24, 25, 29]);
                    // 确保输出目录存在
                    if (!fs.existsSync(OUTPUT_DIR)) {
                        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
                    }
                    console.log('🚀 启动浏览器...');
                    return [4 /*yield*/, playwright_1.chromium.launch({
                            headless: false, // 使用有头模式方便观察
                        })];
                case 2:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newContext()];
                case 3:
                    context = _a.sent();
                    return [4 /*yield*/, context.newPage()];
                case 4:
                    page = _a.sent();
                    // 监听所有网络请求
                    page.on('request', function (request) {
                        var req = {
                            url: request.url(),
                            method: request.method(),
                            resourceType: request.resourceType(),
                            requestHeaders: request.headers(),
                        };
                        // 记录 POST 请求的 body
                        if (request.method() === 'POST') {
                            req.requestBody = request.postData();
                        }
                        networkRequests.push(req);
                        // 实时输出重要请求
                        if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                            console.log("\uD83D\uDCE1 [".concat(request.method(), "] ").concat(request.url()));
                        }
                    });
                    // 监听响应
                    page.on('response', function (response) { return __awaiter(_this, void 0, void 0, function () {
                        var url, req, body, e_3;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    url = response.url();
                                    req = networkRequests.find(function (r) { return r.url === url && !r.responseStatus; });
                                    if (!req) return [3 /*break*/, 4];
                                    req.responseStatus = response.status();
                                    req.responseHeaders = response.headers();
                                    req.timing = response.timing();
                                    if (!(response.request().resourceType() === 'xhr' ||
                                        response.request().resourceType() === 'fetch')) return [3 /*break*/, 4];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, response.text()];
                                case 2:
                                    body = _a.sent();
                                    req.responseBody = body;
                                    console.log("\u2705 [".concat(response.status(), "] ").concat(url));
                                    if (body && body.length < 500) {
                                        console.log("   Response: ".concat(body.substring(0, 200)));
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    e_3 = _a.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    console.log('🌐 访问 mdnice 编辑器...');
                    return [4 /*yield*/, page.goto(MDNICE_URL, {
                            waitUntil: 'networkidle',
                            timeout: 60000,
                        })];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 10, , 11]);
                    closeButton = page.getByRole('button', { name: 'Close' });
                    return [4 /*yield*/, closeButton.isVisible({ timeout: 3000 })];
                case 7:
                    if (!_a.sent()) return [3 /*break*/, 9];
                    return [4 /*yield*/, closeButton.click()];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    e_1 = _a.sent();
                    return [3 /*break*/, 11];
                case 11:
                    _a.trys.push([11, 15, , 16]);
                    driverOverlay = page.locator('.driver-overlay');
                    return [4 /*yield*/, driverOverlay.isVisible({ timeout: 2000 })];
                case 12:
                    if (!_a.sent()) return [3 /*break*/, 14];
                    return [4 /*yield*/, page.keyboard.press('Escape')];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    e_2 = _a.sent();
                    return [3 /*break*/, 16];
                case 16:
                    console.log('⏳ 等待编辑器加载...');
                    return [4 /*yield*/, page.waitForSelector('.CodeMirror', { timeout: 30000 })];
                case 17:
                    _a.sent();
                    return [4 /*yield*/, page.waitForTimeout(2000)];
                case 18:
                    _a.sent();
                    console.log('📝 注入测试 Markdown...');
                    testMarkdown = "# \u6D4B\u8BD5\u6807\u9898\n\n\u8FD9\u662F\u4E00\u6BB5**\u6D4B\u8BD5\u6587\u672C**\uFF0C\u5305\u542B\uFF1A\n\n- \u5217\u8868\u9879 1\n- \u5217\u8868\u9879 2\n\n```javascript\nconsole.log('Hello mdnice!');\n```\n\n> \u8FD9\u662F\u4E00\u6BB5\u5F15\u7528\n\n![\u6D4B\u8BD5\u56FE\u7247](https://via.placeholder.com/150)\n";
                    // 清空并注入内容
                    return [4 /*yield*/, page.evaluate(function (md) {
                            var cm = document.querySelector('.CodeMirror');
                            if (cm && cm.CodeMirror) {
                                cm.CodeMirror.setValue('');
                                cm.CodeMirror.setValue(md);
                                cm.CodeMirror.refresh();
                            }
                        }, testMarkdown)];
                case 19:
                    // 清空并注入内容
                    _a.sent();
                    console.log('⏳ 等待渲染完成...');
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 20:
                    _a.sent();
                    console.log('🔍 分析预览区 HTML...');
                    return [4 /*yield*/, page.evaluate(function () {
                            // 查找预览区域
                            var preview = document.querySelector('#nice-md-box') ||
                                document.querySelector('.preview') ||
                                document.querySelector('[class*="preview"]');
                            if (preview) {
                                return {
                                    found: true,
                                    innerHTML: preview.innerHTML,
                                    outerHTML: preview.outerHTML,
                                    selector: preview.className,
                                };
                            }
                            return { found: false };
                        })];
                case 21:
                    previewHTML = _a.sent();
                    if (previewHTML.found) {
                        console.log('✅ 找到预览区域!');
                        console.log("   Selector: ".concat(previewHTML.selector));
                        htmlPath = path.join(OUTPUT_DIR, 'preview.html');
                        fs.writeFileSync(htmlPath, previewHTML.outerHTML);
                        console.log("   \u5DF2\u4FDD\u5B58\u5230: ".concat(htmlPath));
                    }
                    console.log('🔍 提取页面脚本和资源...');
                    return [4 /*yield*/, page.evaluate(function () {
                            var scripts = [];
                            var styles = [];
                            // 获取所有脚本标签
                            document.querySelectorAll('script[src]').forEach(function (script) {
                                scripts.push(script.src);
                            });
                            // 获取所有样式标签
                            document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
                                styles.push(link.href);
                            });
                            // 查找关键的全局变量或函数
                            var globals = Object.keys(window).filter(function (key) {
                                return key.toLowerCase().includes('md') ||
                                    key.toLowerCase().includes('markdown') ||
                                    key.toLowerCase().includes('nice');
                            });
                            return { scripts: scripts, styles: styles, globals: globals };
                        })];
                case 22:
                    pageInfo = _a.sent();
                    console.log("\n\uD83D\uDCE6 \u9875\u9762\u8D44\u6E90\u5206\u6790:");
                    console.log("   \u811A\u672C\u6587\u4EF6\u6570: ".concat(pageInfo.scripts.length));
                    console.log("   \u6837\u5F0F\u6587\u4EF6\u6570: ".concat(pageInfo.styles.length));
                    console.log("   \u53EF\u80FD\u76F8\u5173\u7684\u5168\u5C40\u53D8\u91CF: ".concat(pageInfo.globals.join(', ')));
                    // 保存页面资源信息
                    fs.writeFileSync(path.join(OUTPUT_DIR, 'page-resources.json'), JSON.stringify(pageInfo, null, 2));
                    console.log('\n⏳ 保持页面打开 10 秒，观察更多网络请求...');
                    return [4 /*yield*/, page.waitForTimeout(10000)];
                case 23:
                    _a.sent();
                    requestsPath = path.join(OUTPUT_DIR, 'network-requests.json');
                    fs.writeFileSync(requestsPath, JSON.stringify(networkRequests, null, 2));
                    console.log("\n\uD83D\uDCBE \u5DF2\u4FDD\u5B58 ".concat(networkRequests.length, " \u4E2A\u7F51\u7EDC\u8BF7\u6C42\u5230: ").concat(requestsPath));
                    apiRequests = networkRequests.filter(function (r) {
                        return r.resourceType === 'xhr' || r.resourceType === 'fetch';
                    });
                    postRequests = networkRequests.filter(function (r) { return r.method === 'POST'; });
                    console.log("\n\uD83D\uDCCA \u7F51\u7EDC\u8BF7\u6C42\u7EDF\u8BA1:");
                    console.log("   \u603B\u8BF7\u6C42\u6570: ".concat(networkRequests.length));
                    console.log("   API \u8BF7\u6C42: ".concat(apiRequests.length));
                    console.log("   POST \u8BF7\u6C42: ".concat(postRequests.length));
                    if (apiRequests.length > 0) {
                        console.log("\n\uD83D\uDD0D API \u8BF7\u6C42\u5217\u8868:");
                        apiRequests.forEach(function (req) {
                            console.log("   [".concat(req.method, "] ").concat(req.url));
                        });
                    }
                    console.log('\n✅ 探测完成! 请查看 research/output/ 目录的结果文件');
                    console.log('   - network-requests.json: 所有网络请求');
                    console.log('   - preview.html: 预览区 HTML');
                    console.log('   - page-resources.json: 页面资源信息');
                    return [3 /*break*/, 29];
                case 24:
                    error_1 = _a.sent();
                    console.error('❌ 探测失败:', error_1);
                    return [3 /*break*/, 29];
                case 25:
                    if (!browser) return [3 /*break*/, 28];
                    console.log('\n⏳ 10 秒后关闭浏览器...');
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10000); })];
                case 26:
                    _a.sent();
                    return [4 /*yield*/, browser.close()];
                case 27:
                    _a.sent();
                    _a.label = 28;
                case 28: return [7 /*endfinally*/];
                case 29: return [2 /*return*/];
            }
        });
    });
}
// 运行探测
probe().catch(console.error);
