const path = require('path')

// 初始化环境变量
const defaultInputDir = '../../../../src'
const defaultOutputDir = '../../../../dist/' +
  (process.env.NODE_ENV === 'production' ? 'build' : 'dev') + '/' +
  process.env.UNI_PLATFORM

if (process.env.UNI_INPUT_DIR && process.env.UNI_INPUT_DIR.indexOf('./') === 0) {
  process.env.UNI_INPUT_DIR = path.resolve(process.cwd(), process.env.UNI_INPUT_DIR)
}
if (process.env.UNI_OUTPUT_DIR && process.env.UNI_OUTPUT_DIR.indexOf('./') === 0) {
  process.env.UNI_OUTPUT_DIR = path.resolve(process.cwd(), process.env.UNI_OUTPUT_DIR)
}

process.env.UNI_PLATFORM = process.env.UNI_PLATFORM || 'h5'
process.env.VUE_APP_PLATFORM = process.env.UNI_PLATFORM
process.env.UNI_INPUT_DIR = process.env.UNI_INPUT_DIR || path.resolve(__dirname, defaultInputDir)
process.env.UNI_OUTPUT_DIR = process.env.UNI_OUTPUT_DIR || path.resolve(__dirname, defaultOutputDir)

if (process.env.UNI_PLATFORM === 'app-plus') {
  process.env.UNI_OUTPUT_TMP_DIR = path.resolve(process.env.UNI_OUTPUT_DIR, '../.tmp/app-plus')
}

process.env.UNI_CLI_CONTEXT = path.resolve(__dirname, '../../../../')

process.UNI_LIBRARIES = process.UNI_LIBRARIES || ['@dcloudio/uni-ui']

const {
  isSupportSubPackages,
  runByHBuilderX,
  isInHBuilderXAlpha,
  getPagesJson,
  getManifestJson
} = require('@dcloudio/uni-cli-shared')

const pagesJsonObj = getPagesJson()
// 读取分包
process.UNI_SUBPACKAGES = {}
if (Array.isArray(pagesJsonObj.subPackages)) {
  pagesJsonObj.subPackages.forEach(subPackage => {
    if (subPackage && subPackage.root) {
      const {
        name,
        root,
        independent
      } = subPackage
      process.UNI_SUBPACKAGES[root] = {
        name,
        root,
        independent
      }
    }
  })
}

const manifestJsonObj = getManifestJson()
const platformOptions = manifestJsonObj[process.env.UNI_PLATFORM] || {}

if (manifestJsonObj.debug) {
  process.env.VUE_APP_DEBUG = true
}

process.UNI_STAT_CONFIG = {
  appid: manifestJsonObj.appid
}

// fixed by hxy alpha 版默认启用新的框架
if (isInHBuilderXAlpha) {
  if (!platformOptions.hasOwnProperty('usingComponents')) {
    platformOptions.usingComponents = true
  }
}

if (process.env.UNI_PLATFORM === 'h5') {
  const optimization = platformOptions.optimization
  if (optimization) {
    // 发行模式且主动启用优化
    const treeShaking = optimization.treeShaking
    if (
      treeShaking &&
      treeShaking.enable &&
      process.env.NODE_ENV === 'production'
    ) {
      process.env.UNI_OPT_TREESHAKINGNG = true
      process.UNI_USER_APIS = new Set()
      if (Array.isArray(treeShaking.modules) && treeShaking.modules.length) {
        const {
          parseUserApis
        } = require('@dcloudio/uni-cli-shared/lib/api')
        try {
          const modules = require('@dcloudio/uni-h5/lib/modules.json')
          process.UNI_USER_APIS = parseUserApis(treeShaking.modules || [], modules)
        } catch (e) {}
      }
    }
    if (optimization.prefetch) {
      process.env.UNI_OPT_PREFETCH = true
    }
    if (optimization.preload) {
      process.env.UNI_OPT_PRELOAD = true
    }
  }
}

if (process.env.UNI_PLATFORM === 'mp-qq') { // QQ小程序 强制自定义组件模式
  platformOptions.usingComponents = true
}

let isNVueCompiler = false
if (process.env.UNI_PLATFORM === 'app-plus') {
  if (platformOptions.nvueCompiler === 'uni-app') {
    isNVueCompiler = true
  }
  if (platformOptions.renderer === 'native') {
    process.env.UNI_USING_NATIVE = true
    process.env.UNI_USING_V8 = true
    process.env.UNI_OUTPUT_TMP_DIR = ''
  }
} else { // 其他平台，待确认配置方案
  if (
    manifestJsonObj['app-plus'] &&
    manifestJsonObj['app-plus']['nvueCompiler'] === 'uni-app'
  ) {
    isNVueCompiler = true
  }
}

if (isNVueCompiler) {
  process.env.UNI_USING_NVUE_COMPILER = true
}

if (platformOptions.usingComponents === true) {
  if (process.env.UNI_PLATFORM !== 'h5') {
    process.env.UNI_USING_COMPONENTS = true
  }
  if (process.env.UNI_PLATFORM === 'app-plus') {
    process.env.UNI_USING_V8 = true
  }
}

if (
  process.env.UNI_USING_COMPONENTS ||
  process.env.UNI_PLATFORM === 'h5'
) { // 自定义组件模式或 h5 平台
  const uniStatistics = Object.assign(
    manifestJsonObj.uniStatistics || {},
    platformOptions.uniStatistics || {}
  )

  if (
    uniStatistics.enable !== false &&
    (
      process.env.NODE_ENV === 'production' ||
      uniStatistics.enable === 'development'
    )
  ) {
    if (process.UNI_STAT_CONFIG.appid) {
      process.env.UNI_USING_STAT = true
    } else {
      console.log()
      console.warn(`当前应用未配置Appid，无法使用uni统计，详情参考：https://ask.dcloud.net.cn/article/36303`)
      console.log()
    }
  }
}

if (process.env.UNI_USING_COMPONENTS) { // 是否启用分包优化
  if (platformOptions.optimization) {
    if (
      isSupportSubPackages() &&
      platformOptions.optimization.subPackages &&
      Object.keys(process.UNI_SUBPACKAGES).length
    ) {
      process.env.UNI_OPT_SUBPACKAGES = true
    }
  }
}

// 输出编译器版本等信息
if (process.env.UNI_PLATFORM !== 'h5') {
  try {
    const modeText = '当前项目编译模式：' +
      (platformOptions.usingComponents ? '自定义组件模式' : '非自定义组件模式') +
      '。编译模式差异见：https://ask.dcloud.net.cn/article/35843'

    let info = ''
    if (process.env.UNI_PLATFORM === 'app-plus') {
      const pagesPkg = require('@dcloudio/webpack-uni-pages-loader/package.json')
      if (pagesPkg) {
        info = '编译器版本：' + pagesPkg['uni-app']['compilerVersion']
      }
      const glob = require('glob')
      if (glob.sync('pages/**/*.nvue', {
        cwd: process.env.UNI_INPUT_DIR
      }).length) {
        console.log(info)
        console.log(modeText)

        console.log('当前nvue编译模式：' + (isNVueCompiler ? 'uni-app' : 'weex') +
          ' 。编译模式差异见：https://ask.dcloud.net.cn/article/36074')
      } else {
        console.log(info + '，' + modeText)
      }
    } else {
      console.log(modeText)
    }
  } catch (e) {}
}

const moduleAlias = require('module-alias')

// 将 template-compiler 指向修订后的版本
moduleAlias.addAlias('vue-template-compiler', '@dcloudio/vue-cli-plugin-uni/packages/vue-template-compiler')
moduleAlias.addAlias('@megalo/template-compiler', '@dcloudio/vue-cli-plugin-uni/packages/@megalo/template-compiler')
moduleAlias.addAlias('mpvue-template-compiler', '@dcloudio/vue-cli-plugin-uni/packages/mpvue-template-compiler')

if (runByHBuilderX) {
  const oldError = console.error
  console.error = function (msg) {
    if (typeof msg === 'string' && msg.includes(
      '[BABEL] Note: The code generator has deoptimised the styling of')) {
      const filePath = msg.replace('[BABEL] Note: The code generator has deoptimised the styling of ', '').split(
        ' as ')[0]
      console.log('[警告] `' + path.relative(process.env.UNI_INPUT_DIR, filePath) +
        '` 文件体积超过 500KB，已跳过压缩以及 ES6 转 ES5 的处理，手机端使用过大的js库影响性能。')
    } else {
      oldError.apply(console, arguments)
      // TODO 如果是首次运行遇到错误直接退出
    }
  }
}

module.exports = {
  manifestPlatformOptions: platformOptions
}
