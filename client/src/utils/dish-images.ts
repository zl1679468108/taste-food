/**
 * @deprecated DEPRECATED — 本地菜名→图片映射仅作兜底。
 * 展示优先使用接口返回的 imageUrl（图库/种子导入回填）。
 * 新功能请勿再扩展本映射；空图请走图库 imageUrl + FoodThumb 占位链。
 *
 * 菜品名 → 本地菜品图
 * 优先精确匹配，再按关键词命中，供 FoodThumb 在 imageUrl 为空时使用
 */
import lambRibs from '../assets/dishes/lamb-ribs.jpg';
import chickenWings from '../assets/dishes/chicken-wings.jpg';
import chickenGizzard from '../assets/dishes/chicken-gizzard.jpg';
import beefSkewer from '../assets/dishes/beef-skewer.jpg';
import lambSkewer from '../assets/dishes/lamb-skewer.jpg';
import spareRibs from '../assets/dishes/spare-ribs.jpg';
import grilledShrimp from '../assets/dishes/grilled-shrimp.jpg';
import eggplant from '../assets/dishes/eggplant.jpg';
import enoki from '../assets/dishes/enoki.jpg';
import chives from '../assets/dishes/chives.jpg';
import potato from '../assets/dishes/potato.jpg';
import corn from '../assets/dishes/corn.jpg';
import cola from '../assets/dishes/cola.jpg';
import sprite from '../assets/dishes/sprite.jpg';
import beer from '../assets/dishes/beer.jpg';
import water from '../assets/dishes/water.jpg';
import plumDrink from '../assets/dishes/plum-drink.jpg';
import coldNoodles from '../assets/dishes/cold-noodles.jpg';
import mantou from '../assets/dishes/mantou.jpg';
import toast from '../assets/dishes/toast.jpg';
import friedRice from '../assets/dishes/fried-rice.jpg';

const EXACT_MAP: Record<string, string> = {
  秘制烤羊排: lambRibs,
  招牌烤鸡翅: chickenWings,
  烤鸡胗: chickenGizzard,
  炭烤牛肉串: beefSkewer,
  香辣羊肉串: lambSkewer,
  蜜汁烤排骨: spareRibs,
  烤大虾: grilledShrimp,
  蒜蓉烤茄子: eggplant,
  烤茄子: eggplant,
  烤金针菇: enoki,
  烤韭菜: chives,
  烤土豆片: potato,
  烤玉米: corn,
  可乐: cola,
  雪碧: sprite,
  青岛啤酒: beer,
  冰镇啤酒: beer,
  矿泉水: water,
  酸梅汤: plumDrink,
  烤冷面: coldNoodles,
  烤馒头片: mantou,
  烤面包片: toast,
  炒饭: friedRice,
};

/** 关键词按优先级从具体到宽泛 */
const KEYWORD_MAP: Array<[string, string]> = [
  ['羊排', lambRibs],
  ['鸡翅', chickenWings],
  ['鸡胗', chickenGizzard],
  ['牛肉', beefSkewer],
  ['羊肉', lambSkewer],
  ['排骨', spareRibs],
  ['大虾', grilledShrimp],
  ['鱿鱼', grilledShrimp],
  ['茄子', eggplant],
  ['金针菇', enoki],
  ['韭菜', chives],
  ['土豆', potato],
  ['玉米', corn],
  ['可乐', cola],
  ['雪碧', sprite],
  ['啤酒', beer],
  ['矿泉水', water],
  ['酸梅', plumDrink],
  ['冷面', coldNoodles],
  ['馒头', mantou],
  ['面包', toast],
  ['炒饭', friedRice],
  ['饭', friedRice],
];

/** 仅按菜品名解析本地图（不含远程 src） */
export function resolveDishImageByName(name?: string): string | undefined {
  const text = (name || '').trim();
  if (!text) return undefined;
  if (EXACT_MAP[text]) return EXACT_MAP[text];
  for (const [keyword, src] of KEYWORD_MAP) {
    if (text.includes(keyword)) return src;
  }
  return undefined;
}

/**
 * 解析最终展示图候选：远程/业务 src → 本地名映射
 * 不含全局占位图（由 FoodThumb 追加）
 */
export function resolveDishImage(name?: string, src?: string): string | undefined {
  const remote = (src || '').trim();
  if (remote) return remote;
  return resolveDishImageByName(name);
}

export const DISH_IMAGE_COUNT = Object.keys(EXACT_MAP).length;
