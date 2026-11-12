'use strict';
const THEMES = [
  ['tea','01','岭南翡翠','翡翠绒面 · 广彩花边','#123D33','#041C15','#963A2A','tea'],
  ['rain','02','雨夜窗边','深蓝绒面 · 雨窗竹影','#263F60','#0C192F','#284D79','rain'],
  ['festival','03','灯火团圆','酒红绒面 · 暖金灯笼','#672E36','#260F1A','#8B2840','festival'],
  ['bamboo','04','竹影清风','墨绿织布 · 竹叶清影','#294C3C','#122A22','#597044','tea'],
  ['celadon','05','青瓷听雨','孔雀青绒 · 青瓷镶边','#245251','#0B3030','#326462','rain'],
  ['osmanthus','06','桂香秋月','暖褐呢面 · 桂花月影','#51472D','#272314','#7C5432','tea'],
  ['sandalwood','07','紫檀雅集','暗紫绒面 · 紫檀铜饰','#513547','#261625','#713E57','tea'],
  ['island','08','海风南岛','海蓝织布 · 贝壳木边','#244C59','#102F3B','#326777','rain'],
  ['lotus','09','荷塘夜色','墨青绒面 · 玉边荷花','#1B4644','#082A29','#2E6253','rain'],
  ['plum','10','雪落梅庭','青灰呢面 · 雪梅银饰','#354653','#172834','#5A687B','rain'],
  ['ink','11','鎏金墨韵','玄黑绒面 · 细金回纹','#2B2B29','#101413','#4D4633','tea'],
  ['liwan','12','荔湾花窗','深青绒面 · 西关彩窗','#214941','#082A25','#78503E','festival'],
].map(([id,asset,name,detail,a,b,back,ambience])=>({id,asset,name,detail,a,b,back,ambience}));
const themeOf = prefs => THEMES.find(t=>t.id===prefs.theme) || THEMES[0];
function createThemeImages(platform, changed) {
  const cache = new Map(), pending = new Set(), failed = new Set();
  return { cache, failed,
    retry() { failed.clear(); },
    get(theme, thumbnail = false) {
      const file = (thumbnail ? 'thumb-' : 'table-') + theme.asset + '.jpg';
      if (cache.has(file)) { const image = cache.get(file); cache.delete(file); cache.set(file,image); return image; }
      if (!platform.themeImage || pending.has(file) || failed.has(file)) return null;
      pending.add(file);
      platform.themeImage(file, image => {
        pending.delete(file);
        if (!image) failed.add(file);
        else {
          cache.set(file,image);
          const full = [...cache.keys()].filter(k=>k.startsWith('table-'));
          while (full.length > 2) cache.delete(full.shift());
        }
        changed();
      });
      return null;
    },
  };
}
module.exports = { THEMES, themeOf, createThemeImages };
