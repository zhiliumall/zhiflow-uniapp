/*
 * Copyright (C) 2025 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** 判断是否为微信浏览器中运行 */
export const isWeiXinBrowser = () => {
  let isWeiXinBrowser = false
  // window.navigator.userAgent属性包含了浏览器类型、版本、操作系统类型、浏览器引擎类型等信息，这个属性可以用来判断浏览器类型
  var ua = navigator.userAgent.toLowerCase()
  if (ua.indexOf('micromessenger') !== -1) {
    isWeiXinBrowser = true
  } else {
    isWeiXinBrowser = false
  }
  return isWeiXinBrowser
}

/** 兼容旧调用：H5 下恒为 false */
export const isMiniPg = () => {
  let isMiniPg = false
  return isMiniPg
}

/** isMiniPg 的别名 */
export const isMpWx = isMiniPg

/** 判断是否为h5 */
export const isH5 = () => {
  let isH5 = false
  isH5 = true
  return isH5
}

/** 判断是否为微信h5-浏览器中运行-微信公众号 */
export const isH5Wx = () => {
  if (isH5() && isWeiXinBrowser()) {
    return true
  }
  return false
}

/** 判断是否是App */
export const isApp = () => {
  let isApp = false
  return isApp
}

/** 判断是否是App-nvue */
export const isAppNvue = () => {
  let isAppNvue = false
  return isAppNvue
}

/** 获取平台类型 */
export const getPlatform = () => {
  // ["H5", "APP", "MA", "H5-PC", "H5-WX"]
  if (isMpWx()) return 'MA'
  if (isH5Wx()) return 'H5-WX'
  if (isApp()) return 'APP'
  return 'H5'
}


export function isSafari() {
    const ua = navigator.userAgent.toLowerCase();
    // 核心判断逻辑：
    // 1. 必须包含 'safari'
    // 2. 不能包含 'crios' (iOS Chrome)
    // 3. 不能包含 'fxios' (iOS Firefox)
    // 4. 不能包含 'quark' (夸克浏览器)
    // 5. 不能包含 'chrome' (桌面版Chrome或Android Chrome)
    // 6. 不能包含 'edg' (Edge)
    // 7. 不能包含 'opr' (Opera)
    // 8. 必须包含 'iphone' 或 'ipad' 或 'ipod'
    return /iphone|ipad|ipod/.test(ua) &&  // iOS设备
           ua.includes('safari') &&         // 是Safari
           !ua.includes('crios') &&         // 排除iOS Chrome
           !ua.includes('fxios') &&         // 排除iOS Firefox
           !ua.includes('quark') &&         // 排除夸克
           !ua.includes('chrome') &&        // 排除Chrome
           !ua.includes('edg') &&           // 排除Edge
           !ua.includes('opr') &&           // 排除Opera
           !ua.includes('firefox') &&       // 排除Firefox
           !ua.includes('mqqbrowser') &&    // 排除QQ浏览器
           !ua.includes('ucbrowser');       // 排

  return false;
}
