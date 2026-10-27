/*
 * Copyright (C) 2024 gaipharma.com
 * SPDX-License-Identifier: AGPL-3.0-only
 */

//数字工具 - 建议数字的加减处理都用这个工具方法,否则js非常容易把两个数字当字符串拼接
const numberUtil = {
  numberFormat: (value, num) => {
    //小数点精确到指定位数
    return value?.toFixed?.(num) ?? value;
    // return parseFloat(value.toFixed(num));
  },
  numberSubtract: (value1, value2) => {
    //减法运算value1-value2
    const v = parseFloat(value1) - parseFloat(value2);
    return parseFloat(v.toFixed(2));
  },
  numberAddition: (value1, value2) => {
    //加法运算value1+value2
    const v = parseFloat(value1) + parseFloat(value2);
    return parseFloat(v.toFixed(2));
  },
  getAreaDistance: (lat1, lng1, lat2, lng2) => {
    //计算经纬距离
    lat1 = lat1 || 0;
    lng1 = lng1 || 0;
    lat2 = lat2 || 0;
    lng2 = lng2 || 0;

    if (!lat1 || !lng1) {
      return "0";
    }

    const rad1 = (lat1 * Math.PI) / 180.0;
    const rad2 = (lat2 * Math.PI) / 180.0;
    const a = rad1 - rad2;
    const b = (lng1 * Math.PI) / 180.0 - (lng2 * Math.PI) / 180.0;
    const r = 6378137;
    let rs =
      r *
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin(a / 2) ** 2 +
            Math.cos(rad1) * Math.cos(rad2) * Math.sin(b / 2) ** 2
        )
      );
    rs = rs / 1000;
    rs = rs.toFixed(2);
    return rs;
  },
};

// 金额格式化
export function amountFormat(value) {
  if (Number.isNaN(value) || value === null || value === undefined) {
    return value;
  }
  return value.toFixed(2);
}

export default {
  //暴露接口调用
  numberFormat: numberUtil.numberFormat,
  numberSubtract: numberUtil.numberSubtract,
  numberAddition: numberUtil.numberAddition,
  getAreaDistance: numberUtil.getAreaDistance,
};
