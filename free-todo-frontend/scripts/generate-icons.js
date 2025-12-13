/**
 * 图标生成脚本
 *
 * 使用方法：
 * 1. 安装依赖：pnpm add -D png2icons
 * 2. 运行脚本：node scripts/generate-icons.js
 *
 * 这个脚本将从 public/logo.png 生成各平台所需的图标格式
 */

const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "../public/logo.png");
const electronDir = path.join(__dirname, "../electron");

// 检查源文件是否存在
if (!fs.existsSync(sourcePath)) {
	console.error("❌ 错误: 找不到源图标文件:", sourcePath);
	process.exit(1);
}

console.log("📦 开始生成应用图标...\n");
console.log("源文件:", sourcePath);
console.log("输出目录:", electronDir);
console.log("\n注意: 此脚本需要额外的依赖来生成 .icns 和 .ico 格式");
console.log("请参考 electron/ICONS_README.md 中的详细说明\n");

// 复制 PNG 文件（Linux 使用）
const pngDest = path.join(electronDir, "icon.png");
if (fs.existsSync(pngDest)) {
	console.log("✅ icon.png 已存在");
} else {
	fs.copyFileSync(sourcePath, pngDest);
	console.log("✅ 已生成 icon.png (Linux)");
}

console.log("\n📝 下一步:");
console.log(
	"1. 使用在线工具或专业软件生成 macOS (.icns) 和 Windows (.ico) 图标",
);
console.log("2. 将生成的文件放置到 electron/ 目录");
console.log("3. 或者使用 electron-icon-builder 等工具自动生成");
console.log("\n详细说明请查看: electron/ICONS_README.md");

// 可选：尝试使用 png2icons（如果已安装）
try {
	const png2icons = require("png2icons");
	const input = fs.readFileSync(sourcePath);

	// 生成 ICO (Windows)
	const icoBuffer = png2icons.createICO(input, png2icons.BEZIER, 0, 0, true);
	if (icoBuffer) {
		fs.writeFileSync(path.join(electronDir, "icon.ico"), icoBuffer);
		console.log("\n✅ 已自动生成 icon.ico (Windows)");
	}

	// 生成 ICNS (macOS)
	const icnsBuffer = png2icons.createICNS(input, png2icons.BEZIER, 0);
	if (icnsBuffer) {
		fs.writeFileSync(path.join(electronDir, "icon.icns"), icnsBuffer);
		console.log("✅ 已自动生成 icon.icns (macOS)");
	}

	console.log("\n🎉 所有图标生成完成！");
} catch (error) {
	if (error.code === "MODULE_NOT_FOUND") {
		console.log("\n💡 提示: 安装 png2icons 可以自动生成所有格式的图标:");
		console.log("   pnpm add -D png2icons");
		console.log("   然后重新运行此脚本");
	} else {
		console.error("\n⚠️ 自动生成图标时出错:", error.message);
	}
}
