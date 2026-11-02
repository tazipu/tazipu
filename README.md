# 好记帐 · 手机版（PWA）使用说明

本目录是桌面 Electron 版「好记帐」的手机网页版（PWA）。同一套记账规则、同一套数据格式，
**电脑宽表**和**手机卡片**自动切换，数据自动保存在本机浏览器，离线可用，并可与电脑桌面版互相导入导出。

- 桌面版工程：`..\index.html`（Electron，`npm start` 启动，`npm run build` 打包 Windows 安装包）
- 本手机版工程：当前目录 `pwa\`，纯静态网页，无需安装即可在手机浏览器运行；后续可用 Capacitor 套壳打包成安卓 APK（见文末）。

---

## 一、目录结构

```
pwa\
├─ index.html              页面骨架（桌面宽表 + 手机卡片 + 回收站弹窗）
├─ manifest.webmanifest    PWA 安装清单（应用名、图标、竖屏、独立窗口）
├─ sw.js                   Service Worker 离线缓存（改代码后版本号需 +1）
├─ server.js               零依赖 Node.js 本地静态服务器（自动显示电脑/手机地址）
├─ start-pwa.bat           Windows 一键启动（自动找 Node，调用 server.js）
├─ css\styles.css         样式，900px 断点切换宽表 / 卡片
├─ js\db.js                IndexedDB 本地持久层（自动保存、启动读取）
├─ js\app.js               全部记账业务逻辑（增删插、上下移、撤销前进、回收站、导入导出）
├─ vendor\xlsx.full.min.js 本地 XLSX 组件（离线可用，不依赖网络 CDN）
└─ icons\                  应用图标 192 / 512 / maskable
```

> 注意：**不能直接双击 `index.html` 用 `file://` 打开**。浏览器在 `file://` 下会禁用
> IndexedDB 和离线缓存，数据无法保存。必须通过本地静态网址（`http://`）访问，见下一节。

---

## 二、在电脑上启动（本地预览）

### 方式 A：一键启动脚本（推荐，Windows）

双击本目录下的 **`start-pwa.bat`**，脚本会自动调用 Node.js 启动本地服务，并在窗口里显示：

- 本机预览地址：`http://127.0.0.1:8765/index.html`
- 手机访问地址：`http://电脑局域网IP:8765/index.html`

浏览器打开本机预览地址即可使用。关闭黑色命令行窗口即停止服务。

> 本脚本依赖 **Node.js**（本机已安装，路径 `C:\Program Files\nodejs\node.exe`）。
> 若提示未检测到 Node.js，到 https://nodejs.org 下载 LTS 版安装后再双击即可。

### 方式 B：手动命令

```powershell
cd 本目录 pwa
node server.js
```

然后浏览器访问 `http://127.0.0.1:8765/index.html`。

---

## 三、在安卓手机上使用（添加到主屏幕，像 App 一样）

1. 电脑和手机连接**同一个 Wi-Fi / 局域网**。
2. 电脑上按第二节启动服务（`start-pwa.bat`），记下窗口里显示的手机访问地址
   （形如 `http://192.168.x.x:8765/index.html`）。
3. 手机用 **Chrome / Edge** 浏览器打开该地址。
4. 点浏览器右上角菜单（⋮）→ **添加到主屏幕 / 安装应用**。
5. 桌面会出现「好记帐」图标，点开就是独立全屏窗口，和原生 App 体验一致；
   第一次加载后会被离线缓存，之后**不连网也能打开记账**。

> 数据保存在**这台手机浏览器的本地存储（IndexedDB）**里，换浏览器、清除浏览器站点数据会清空，
> 所以定期用「导出备份 JSON」存一份到电脑或网盘（见下节）。

### 不经过电脑、纯手机长期使用的两种办法

- **PWA 直连**：把本目录部署到任意静态网站 / 内网服务器，手机浏览器打开网址后安装到主屏幕，
  之后离线可用，不需要电脑一直开机。
- **打包成 APK**：见第六节，套壳后就是独立安装包，不依赖浏览器和网址。

---

## 四、与电脑桌面版互相导入导出（三种格式，格式完全兼容）

### 1. JSON 备份（最完整，推荐日常备份 / 换机迁移）

结构：`{ "dataList": [...], "trashList": [...], "exportTime": "..." }`，字段为
`date, name, spec, price, qty, subtotal, remark`。

- **手机 → 电脑**：手机点「导出备份 JSON」得到 `.json` 文件，传到电脑；桌面版用
  「打开备份 JSON / 另存为」读取即可。
- **电脑 → 手机**：桌面版另存一份 `.json`，传到手机；手机点「导入备份 JSON」，
  弹窗选「确定」=覆盖当前数据，选「取消」=追加到当前数据后面。

### 2. CSV（给 Excel / 表格软件看，逗号分隔，带 UTF-8 BOM，Excel 打开中文不乱码）

列顺序（手机与桌面一致，不要调换）：

```
日期,名称,规格/型号,单价,数量,小计,备注
```

- 手机「导出全部 CSV / 导出选中 CSV」，桌面版「导入 CSV」可读；反过来桌面导出的 CSV，
  手机「导入 CSV」或「粘贴导入」均可。导入时小计按 `单价 × 数量` 重新计算。
- 桌面导出的 CSV 为 UTF-8；若遇到旧版 GBK 编码文件，手机版会自动按 GBK 回退解码。

### 3. XLSX（Excel 工作簿，列顺序与 CSV 不同，注意区分）

列顺序：

```
日期,名称,规格,数量,单价,小计,备注
```

末行为合计行 `合计：x.xx`。手机「导出 XLSX」产物可直接用桌面版同款组件 / Excel 打开；
桌面版导出的 XLSX 本版当前只做导出，未做 XLSX 读取导入（如需可后续补充）。

### 互通注意事项

- 字段口径：`price=单价`，`qty=数量`，`subtotal=小计`（只读，自动计算，不用手填）。
- 手机「粘贴导入」支持追加 / 清空后导入两种模式；CSV 文件导入默认追加。
- 覆盖导入前，原有记录会自动进入手机回收站，不会直接丢失。

---

## 五、功能清单（与桌面版一一对应）

- 新增一行、上方插入、下方插入、上移、下移、删除（进回收站）
- 全选 / 取消全选 / 批量删除选中
- 撤销、前进（最多保留 5 步历史）
- 单价 × 数量自动算小计，顶部与表格底部实时合计
- 回收站：单条恢复、彻底删除、全部恢复、彻底清空
- 导出 / 导入：备份 JSON、CSV（全部 / 选中）、XLSX、粘贴 CSV 导入
- 改动后 300ms 防抖自动保存到本机，关闭页面重开数据仍在
- 宽屏显示九列宽表，窄屏（≤900px）自动切换为卡片列表

---

## 六、第二步：打包成安卓独立 APK（Capacitor 套壳，后续阶段）

当前是 PWA 第一版。要得到能直接安装、不依赖浏览器的 `.apk`，用 Capacitor 把这套静态网页
套进安卓壳，业务代码一行不用改。

### 6.1 环境准备（只装一次）

1. 安装 **Node.js 18+**（本机已装 v24）。
2. 安装 **JDK 17**（Android Studio 自带即可）。
3. 安装 **Android Studio**，在 SDK Manager 里装好：
   - Android SDK Platform 34
   - Android SDK Build-Tools
   - Platform-Tools
4. 配置环境变量：`ANDROID_HOME` 指向 Android SDK 目录，`JAVA_HOME` 指向 JDK。

### 6.2 初始化 Capacitor（在 `pwa` 同级或本目录执行）

```powershell
# 在 pwa 的上级目录（jizhang）新建一个壳工程，或在 pwa 内初始化
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "好记帐" "com.my.recorddetail" --web-dir="pwa"
npm install @capacitor/android
```

> `--web-dir` 指向本 PWA 静态目录；`appId` 沿用桌面版 `com.my.recorddetail` 保持统一。

### 6.3 添加安卓平台并同步

```powershell
npx cap add android
npx cap sync android
```

`npx cap sync` 会把 `pwa` 目录的网页资源拷进安卓工程；之后每次改完网页代码，重新执行：

```powershell
npx cap copy android
```

### 6.4 打包 APK

用 Android Studio 打开 `android\` 目录：

```powershell
npx cap open android
```

在 Android Studio 里 `Build → Build APK(s)`，生成的调试 APK 在
`android\app\build\outputs\apk\debug\app-debug.apk`，可直接传到手机安装。

正式发布需要在 `android\app\` 下配置签名 keystore，再出 release 版 APK / AAB。

### 6.5 套壳后需要注意的点

- PWA 的 Service Worker 在 Capacitor WebView 内可正常离线缓存；`manifest` 图标会被
  转成应用图标（也可在 Android Studio 里替换 `mipmap`）。
- 下载的 CSV / JSON / XLSX 在安卓上会落到系统「下载」目录；如需直接读写手机私有目录，
  后续可再加 `@capacitor/filesystem` 插件。
- 手机本地存储在 WebView 的 IndexedDB 中，卸载应用即清除，记得定期导出 JSON 备份。

---

## 七、已知限制

- XLSX 仅支持导出，不支持读取 XLSX 导入（CSV / JSON 导入已完整兼容桌面版）。
- 日期选择使用手机浏览器原生日期控件，不同品牌手机外观略有差异。
- 本版未做多人联网同步；手机与电脑之间靠 JSON / CSV 文件中转，不实时互通。
