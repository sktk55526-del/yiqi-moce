'use strict';
const NAME_LIMIT = 8;
function normalizeNickname(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 64) throw new Error('名称格式不正确');
  const name = value.normalize('NFKC').trim().replace(/ +/g, ' ');
  if (name.length > NAME_LIMIT) throw new Error('名称最多 8 个字');
  if (name && !/^[\u3400-\u9fffA-Za-z0-9 ·_-]+$/.test(name)) throw new Error('名称可用中文、字母、数字、空格、中点、横线');
  return name;
}
module.exports = { NAME_LIMIT, normalizeNickname };
