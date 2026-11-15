// Shop — PROTOTYP. Mince, vlastněné a nasazené věci se zatím drží jen
// v localStorage tohohle telefonu (žádný server, žádné skutečné platby).
// Kosmetika se nedá koupit přímo — padá jen z bedny (viz case.js).
// Mince se utrácí výhradně za kosmetiku, nikdy za herní výhodu.

// Reset postupu pro všechny: když se PROGRESS_VERSION zvýší, každému hráči
// se při dalším otevření hry jednou smažou mince, skiny, odemčené balíčky,
// vstupenky a denní odměny. Jméno, profilovka a přátelé zůstanou.
const PROGRESS_VERSION = 4; // 2, 3, 4 = resety 27. 9. 2026 (dev postup vyraz_shop_dev se nemaže)
try {
  if (Number(localStorage.getItem('vyraz_progress_version') || 1) < PROGRESS_VERSION) {
    localStorage.removeItem('vyraz_shop');
    localStorage.setItem('vyraz_progress_version', String(PROGRESS_VERSION));
  }
} catch { /* bez localStorage není co mazat */ }

const SHOP_START_COINS = 0; // nový hráč začíná bez mincí — první si vydělá hrou nebo denní odměnou

// Vzácnosti: refund = kolik mincí vrátí duplikát (věc, kterou už máš).
// Šance na jednotlivé vzácnosti má každá truhla vlastní (viz CASES v case.js).
const RARITIES = {
  common: { label: 'Common', color: '#A9B4C8', refund: 15 }, // refund = mince za duplikát: 15 / 40 / 100 / 250
  rare: { label: 'Rare', color: '#3E8BFF', refund: 40 },
  epic: { label: 'Epic', color: '#B66BFF', refund: 100 },
  legendary: { label: 'Legendary', color: '#FF8F3A', refund: 250 },
  // Mythic — nejvzácnější, rámeček Fortune z kola štěstí a dárkový set Jezevčík (v truhlách není,
  // proto není v RARITY_ORDER, podle kterého se počítají šance truhel)
  mythic: { label: 'Mythic', color: '#FF4F9A', refund: 500 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const SHOP_SECTIONS = [
  {
    id: 'frame',
    title: 'Photo frames',
    items: [
      { id: 'frame-ice', name: 'Ice', rarity: 'common', style: '#7DD3FC' },
      { id: 'frame-forest', name: 'Forest', rarity: 'common', style: '#22C55E' },
      { id: 'frame-neon', name: 'Neon', rarity: 'rare', style: 'linear-gradient(135deg,#F472B6,#C084FC,#22D3EE)' },
      { id: 'frame-night', name: 'Midnight', rarity: 'rare', style: 'linear-gradient(135deg,#1E3A8A,#6366F1,#A5B4FC)' },
      { id: 'frame-gold', name: 'Gold', rarity: 'epic', style: 'linear-gradient(135deg,#FDE68A,#F0B429,#B45309)' },
      { id: 'frame-fire', name: 'Flames', rarity: 'epic', style: 'linear-gradient(0deg,#DC2626,#F97316,#FDE047)' },
      { id: 'frame-rainbow', name: 'Rainbow', rarity: 'legendary', style: 'conic-gradient(#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA,#F87171)' },
      { id: 'frame-sunset', name: 'Sunset', rarity: 'common', style: '#FDBA74' },
      { id: 'frame-mint', name: 'Mint', rarity: 'common', style: '#34D399' },
      { id: 'frame-grape', name: 'Grape', rarity: 'common', style: '#8B5CF6' },
      { id: 'frame-ocean', name: 'Ocean', rarity: 'rare', style: 'linear-gradient(135deg,#22D3EE,#2563EB,#1E3A8A)' },
      { id: 'frame-candy', name: 'Cotton Candy', rarity: 'rare', style: 'linear-gradient(135deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'frame-toxic', name: 'Toxic', rarity: 'rare', style: 'linear-gradient(135deg,#BEF264,#22C55E,#14532D)' },
      { id: 'frame-lava', name: 'Lava', rarity: 'epic', style: 'linear-gradient(160deg,#FDE047,#F97316 30%,#DC2626 60%,#450A0A)' },
      { id: 'frame-aurora', name: 'Aurora', rarity: 'epic', style: 'linear-gradient(135deg,#34D399,#22D3EE,#A78BFA,#F472B6)' },
      { id: 'frame-chrome', name: 'Chrome', rarity: 'epic', style: 'linear-gradient(135deg,#F8FAFC,#94A3B8 30%,#F1F5F9 55%,#64748B 80%,#E2E8F0)' },
      { id: 'frame-galaxy', name: 'Galaxy', rarity: 'legendary', style: 'conic-gradient(from 200deg,#1E1B4B,#7C3AED,#EC4899,#22D3EE,#1E1B4B)' },
      { id: 'frame-diamond', name: 'Diamond', rarity: 'legendary', style: 'conic-gradient(#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD,#E9D5FF,#E0F2FE)' },
      { id: 'frame-sand', name: 'Sand', rarity: 'common', style: '#D6B370' },
      { id: 'frame-rose', name: 'Rose', rarity: 'common', style: '#FB7185' },
      { id: 'frame-slate', name: 'Slate', rarity: 'common', style: '#94A3B8' },
      { id: 'frame-sakura', name: 'Sakura', rarity: 'rare', style: 'linear-gradient(135deg,#FFF1F2,#F9A8D4,#EC4899)' },
      { id: 'frame-mango', name: 'Mango', rarity: 'rare', style: 'linear-gradient(135deg,#FDE047,#FB923C)' },
      { id: 'frame-deepsea', name: 'Deep Sea', rarity: 'rare', style: 'linear-gradient(135deg,#22D3EE,#1E3A8A,#0F172A)' },
      { id: 'frame-frost', name: 'Frost', rarity: 'epic', style: 'linear-gradient(135deg,#FFFFFF,#BAE6FD,#60A5FA)' },
      { id: 'frame-love', name: 'Love', rarity: 'epic', style: 'linear-gradient(135deg,#FDA4AF,#F43F5E,#BE123C)' },
      { id: 'frame-electric', name: 'Lightning', rarity: 'epic', style: 'linear-gradient(135deg,#FEF08A,#FACC15 40%,#3B82F6)' },
      { id: 'frame-music', name: 'Music', rarity: 'epic', style: 'linear-gradient(135deg,#A78BFA,#EC4899,#F59E0B)' },
      { id: 'frame-king', name: 'King', rarity: 'legendary', style: 'linear-gradient(135deg,#7C3AED,#FDE68A 45%,#F59E0B 55%,#7C3AED)' },
      { id: 'frame-phoenix', name: 'Phoenix', rarity: 'legendary', style: 'linear-gradient(0deg,#7F1D1D,#F97316 40%,#FDE047 75%,#FFF7ED)' },
      { id: 'frame-sweets', name: 'Sweets', rarity: 'legendary', style: 'repeating-linear-gradient(135deg,#FF5FA2 0 7%,#FFF0F6 7% 12%,#7DD3FC 12% 19%,#FFF0F6 19% 24%)' },
      // Spooky (halloweenská sada — Spooky Chest)
      { id: 'frame-pumpkin', name: 'Pumpkin', rarity: 'common', style: '#F97316' },
      { id: 'frame-moss', name: 'Moss', rarity: 'common', style: '#65A30D' },
      { id: 'frame-bone', name: 'Bone', rarity: 'common', style: '#D6D3D1' },
      { id: 'frame-bat', name: 'Bat Wing', rarity: 'rare', style: 'linear-gradient(135deg,#8B5CF6,#4C1D95,#1E1B4B)' },
      { id: 'frame-slime', name: 'Slime', rarity: 'rare', style: 'linear-gradient(160deg,#ECFCCB,#A3E635 40%,#65A30D 75%,#365314)' },
      { id: 'frame-blood', name: 'Blood Moon', rarity: 'rare', style: 'linear-gradient(135deg,#FCA5A5,#DC2626,#450A0A)' },
      { id: 'frame-ghost', name: 'Ghost', rarity: 'epic', style: 'linear-gradient(135deg,#FFFFFF,#E2E8F0 45%,#A78BFA)' },
      { id: 'frame-witch', name: 'Witch', rarity: 'epic', style: 'linear-gradient(135deg,#86EFAC,#7C3AED 55%,#2E1065)' },
      { id: 'frame-spider', name: 'Spider', rarity: 'epic', style: 'linear-gradient(135deg,#6B7280,#1F2937 50%,#9CA3AF)' },
      { id: 'frame-haunted', name: 'Haunted', rarity: 'legendary', style: 'conic-gradient(from 45deg,#F97316,#7C3AED,#1E1B4B,#7C3AED,#F97316)' },
      { id: 'frame-vampire', name: 'Vampire', rarity: 'legendary', style: 'linear-gradient(160deg,#FECACA,#DC2626 35%,#7F1D1D 65%,#18181B)' },
      // Nová sada (Arcade, Pizza, Disco, Ninja, Robot, Space Cat, Dino…)
      { id: 'frame-lemon', name: 'Lemon', rarity: 'common', style: '#FACC15' },
      { id: 'frame-sky', name: 'Sky Blue', rarity: 'common', style: '#38BDF8' },
      { id: 'frame-berry', name: 'Berry', rarity: 'common', style: '#DB2777' },
      { id: 'frame-arcade', name: 'Arcade', rarity: 'rare', style: 'linear-gradient(135deg,#FACC15,#F43F5E,#6366F1)' },
      { id: 'frame-jungle', name: 'Jungle', rarity: 'rare', style: 'linear-gradient(135deg,#A3E635,#16A34A,#713F12)' },
      { id: 'frame-pizza', name: 'Pizza', rarity: 'rare', style: 'linear-gradient(135deg,#FDE68A,#F59E0B 45%,#DC2626)' },
      { id: 'frame-disco', name: 'Disco', rarity: 'epic', style: 'linear-gradient(135deg,#F472B6,#8B5CF6,#22D3EE,#FDE047)' },
      { id: 'frame-ninja', name: 'Ninja', rarity: 'epic', style: 'linear-gradient(135deg,#374151,#111827 50%,#DC2626)' },
      { id: 'frame-robot', name: 'Robot', rarity: 'epic', style: 'linear-gradient(135deg,#CBD5E1,#38BDF8 45%,#475569)' },
      { id: 'frame-spacecat', name: 'Space Cat', rarity: 'legendary', style: 'linear-gradient(160deg,#A78BFA,#7C3AED 50%,#5B21B6 50%,#4C1D95)' },
      { id: 'frame-dino', name: 'Dino', rarity: 'legendary', style: 'linear-gradient(160deg,#4ADE80,#22C55E 50%,#16A34A 50%,#166534)' },
      // Dragon (dračí / fantasy sada — Dragon Chest)
      { id: 'frame-dragonscale', name: 'Dragon Scale', rarity: 'common', style: '#15803D' },
      { id: 'frame-castle', name: 'Castle', rarity: 'common', style: '#78716C' },
      { id: 'frame-enchanted', name: 'Enchanted', rarity: 'rare', style: 'linear-gradient(135deg,#5EEAD4,#818CF8,#C084FC)' },
      { id: 'frame-knight', name: 'Knight', rarity: 'rare', style: 'linear-gradient(135deg,#E2E8F0,#64748B 50%,#334155)' },
      { id: 'frame-wizard', name: 'Wizard', rarity: 'epic', style: 'linear-gradient(135deg,#6366F1,#7C3AED 50%,#1E1B4B)' },
      { id: 'frame-crystal', name: 'Crystal', rarity: 'epic', style: 'linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC)' },
      { id: 'frame-dragon', name: 'Dragon', rarity: 'legendary', style: 'linear-gradient(160deg,#EF4444,#B91C1C 50%,#7F1D1D 50%,#450A0A)' },
      // Snapfam export (SVG rámečky, assets/frames) — sady Winter Party, Space Cadet a Street Art; viz CASES v case.js.
      // frame-cocoa dřív existoval jako běžný hnědý rámeček — stejné id, teď nové SVG (Rare); kdo ho vlastní, ho má dál.
      { id: 'frame-snowball', name: 'Snowball', rarity: 'common', style: '#CFE8FF', svg: true },
      { id: 'frame-mitten', name: 'Mitten', rarity: 'common', style: '#E8424F', svg: true },
      { id: 'frame-cocoa', name: 'Cocoa', rarity: 'rare', style: '#6B3B22', svg: true },
      { id: 'frame-candy-cane', name: 'Candy Cane', rarity: 'rare', style: '#E8313F', svg: true },
      { id: 'frame-fairy-lights', name: 'Fairy Lights', rarity: 'epic', style: '#2E7A4F', svg: true, anim: ['bulbs'] },
      { id: 'frame-gift-wrap', name: 'Gift Wrap', rarity: 'epic', style: '#E23B5A', svg: true, anim: ['bow'] },
      { id: 'frame-snow-globe', name: 'Snow Globe', rarity: 'legendary', style: '#7CC4F0', svg: true, round: true, anim: ['snow'] },
      { id: 'frame-moon-grey', name: 'Moon Grey', rarity: 'common', style: '#A3ABBD', svg: true },
      { id: 'frame-nebula-blue', name: 'Nebula Blue', rarity: 'common', style: '#4A6FE8', svg: true },
      { id: 'frame-stardust', name: 'Stardust', rarity: 'rare', style: '#2B3A99', svg: true },
      { id: 'frame-saturn', name: 'Saturn', rarity: 'rare', style: '#D9934A', svg: true },
      { id: 'frame-rocket', name: 'Rocket', rarity: 'epic', style: '#5B3FD0', svg: true, anim: ['rocket'] },
      { id: 'frame-alien', name: 'Alien', rarity: 'epic', style: '#1FA463', svg: true, anim: ['alien'] },
      { id: 'frame-black-hole', name: 'Black Hole', rarity: 'legendary', style: '#6B3FE0', svg: true, anim: ['swirl', 'rim'] },
      { id: 'frame-asphalt', name: 'Asphalt', rarity: 'common', style: '#5A5A6A', svg: true },
      { id: 'frame-spray-red', name: 'Spray Red', rarity: 'common', style: '#FF3B4E', svg: true },
      { id: 'frame-sticker-bomb', name: 'Sticker Bomb', rarity: 'rare', style: '#FF5CA8', svg: true },
      { id: 'frame-sneaker', name: 'Sneaker', rarity: 'rare', style: '#3E7BFA', svg: true },
      { id: 'frame-graffiti', name: 'Graffiti', rarity: 'epic', style: '#FF3FA4', svg: true, anim: ['spray'] },
      { id: 'frame-neon-sign', name: 'Neon Sign', rarity: 'epic', style: '#FF4FD8', svg: true, anim: ['tube'] },
      { id: 'frame-boombox', name: 'Boombox', rarity: 'legendary', style: '#2BE0C8', svg: true, anim: ['speakers'] },
      // jen z dárkového odkazu (gift.js) — v žádné truhle ani na kole
      { id: 'frame-obzerstvi', name: 'Obžerství', rarity: 'legendary', promoOnly: true, style: 'linear-gradient(160deg,#FBBF24,#EF4444 50%,#B91C1C 50%,#7F1D1D)' },
      // jen z druhého dárkového odkazu (gift.js) — mythic, v žádné truhle ani na kole
      { id: 'frame-jezevcik', name: 'Jezevčík', rarity: 'mythic', promoOnly: true, style: 'linear-gradient(160deg,#E0A066,#B4642E 50%,#8A4620 50%,#5C2A0E)' },
      // jen z třetího dárkového odkazu (gift.js) — mythic, v žádné truhle ani na kole
      { id: 'frame-miku', name: 'Miku', rarity: 'mythic', promoOnly: true, style: 'linear-gradient(160deg,#5EEAD4,#14B8A6 50%,#F97316 50%,#0E7490)' },
      // jen z kola štěstí (wheel.js)
      { id: 'frame-fortune', name: 'Fortune', rarity: 'mythic', wheelOnly: true, style: 'conic-gradient(from 20deg,#FDE047,#22C55E,#FDE047,#A855F7,#FDE047)' },
    ],
  },
  {
    id: 'name',
    title: 'Name color',
    items: [
      { id: 'name-violet', name: 'Violet', rarity: 'common', color: '#C084FC' },
      { id: 'name-mint', name: 'Mint', rarity: 'common', color: '#5EEAD4' },
      { id: 'name-pink', name: 'Pink', rarity: 'common', color: '#F9A8D4' },
      { id: 'name-gold', name: 'Golden', rarity: 'rare', color: '#FBBF24' },
      { id: 'name-ice', name: 'Icy', rarity: 'rare', gradient: 'linear-gradient(90deg,#E0F2FE,#38BDF8)' },
      { id: 'name-fire', name: 'Fiery', rarity: 'epic', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626)' },
      { id: 'name-rainbow', name: 'Rainbow', rarity: 'legendary', gradient: 'linear-gradient(90deg,#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA)' },
      { id: 'name-sky', name: 'Sky', rarity: 'common', color: '#7DD3FC' },
      { id: 'name-lime', name: 'Lime', rarity: 'common', color: '#BEF264' },
      { id: 'name-peach', name: 'Peach', rarity: 'common', color: '#FDBA74' },
      { id: 'name-sunset', name: 'Sunset', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDBA74,#F472B6)' },
      { id: 'name-toxic', name: 'Toxic', rarity: 'rare', gradient: 'linear-gradient(90deg,#BEF264,#22C55E)' },
      { id: 'name-candy', name: 'Candy', rarity: 'rare', gradient: 'linear-gradient(90deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'name-chrome', name: 'Chrome', rarity: 'epic', gradient: 'linear-gradient(90deg,#F8FAFC,#94A3B8,#F1F5F9,#94A3B8)' },
      { id: 'name-galaxy', name: 'Galactic', rarity: 'legendary', gradient: 'linear-gradient(90deg,#A78BFA,#EC4899,#22D3EE)' },
      { id: 'name-diamond', name: 'Diamond', rarity: 'legendary', gradient: 'linear-gradient(90deg,#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD)' },
      { id: 'name-coral', name: 'Coral', rarity: 'common', color: '#FB7185' },
      { id: 'name-sand', name: 'Sandy', rarity: 'common', color: '#E7C98A' },
      { id: 'name-sakura', name: 'Sakura', rarity: 'rare', gradient: 'linear-gradient(90deg,#FFF1F2,#F9A8D4)' },
      { id: 'name-deepsea', name: 'Deep Sea', rarity: 'rare', gradient: 'linear-gradient(90deg,#22D3EE,#3B82F6)' },
      { id: 'name-mango', name: 'Mango', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDE047,#FB923C)' },
      { id: 'name-frost', name: 'Frosty', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFFFFF,#BAE6FD,#60A5FA)' },
      { id: 'name-love', name: 'Lovestruck', rarity: 'epic', gradient: 'linear-gradient(90deg,#FDA4AF,#F43F5E)' },
      { id: 'name-electric', name: 'Electric', rarity: 'epic', gradient: 'linear-gradient(90deg,#FEF08A,#FACC15,#3B82F6)' },
      { id: 'name-king', name: 'Royal', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDE68A,#F59E0B,#FDE68A)' },
      { id: 'name-phoenix', name: 'Phoenix', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626)' },
      // Spooky (halloweenská sada — Spooky Chest)
      { id: 'name-pumpkin', name: 'Pumpkin', rarity: 'common', color: '#FB923C' },
      { id: 'name-bone', name: 'Bone', rarity: 'common', color: '#E7E5E4' },
      { id: 'name-slime', name: 'Slimy', rarity: 'rare', gradient: 'linear-gradient(90deg,#ECFCCB,#A3E635,#65A30D)' },
      { id: 'name-bat', name: 'Batty', rarity: 'rare', gradient: 'linear-gradient(90deg,#C4B5FD,#8B5CF6)' },
      { id: 'name-ghost', name: 'Ghostly', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFFFFF,#C4B5FD,#FFFFFF,#E2E8F0)' },
      { id: 'name-witch', name: 'Witchy', rarity: 'epic', gradient: 'linear-gradient(90deg,#86EFAC,#A855F7,#86EFAC)' },
      { id: 'name-haunted', name: 'Haunted', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDBA74,#F97316,#A855F7,#F97316)' },
      { id: 'name-vampire', name: 'Vampire', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FECACA,#EF4444,#B91C1C,#EF4444)' },
      // Nová sada
      { id: 'name-lemon', name: 'Lemon', rarity: 'common', color: '#FDE047' },
      { id: 'name-blueberry', name: 'Blueberry', rarity: 'common', color: '#818CF8' },
      { id: 'name-cocoa', name: 'Cocoa', rarity: 'common', color: '#D6A77A' },
      { id: 'name-arcade', name: 'Arcade', rarity: 'rare', gradient: 'linear-gradient(90deg,#22D3EE,#F472B6,#FACC15)' },
      { id: 'name-jungle', name: 'Jungle', rarity: 'rare', gradient: 'linear-gradient(90deg,#A3E635,#15803D)' },
      { id: 'name-pizza', name: 'Pizza', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#EF4444)' },
      { id: 'name-disco', name: 'Disco', rarity: 'epic', gradient: 'linear-gradient(90deg,#F472B6,#A78BFA,#22D3EE,#FDE047,#F472B6)' },
      { id: 'name-robot', name: 'Robot', rarity: 'epic', gradient: 'linear-gradient(90deg,#67E8F9,#818CF8,#67E8F9,#A3E635)' },
      { id: 'name-spacecat', name: 'Space Cat', rarity: 'legendary', gradient: 'linear-gradient(90deg,#C4B5FD,#F472B6,#FDE047,#4ADE80,#22D3EE,#C4B5FD)' },
      // Dragon (dračí / fantasy sada — Dragon Chest)
      { id: 'name-dragonscale', name: 'Dragonscale', rarity: 'common', color: '#4ADE80' },
      { id: 'name-knight', name: 'Knightly', rarity: 'common', color: '#B6C2D9' },
      { id: 'name-elven', name: 'Elven', rarity: 'rare', gradient: 'linear-gradient(90deg,#86EFAC,#5EEAD4,#A5B4FC)' },
      { id: 'name-ember', name: 'Ember', rarity: 'rare', gradient: 'linear-gradient(90deg,#FCA5A5,#F97316,#B91C1C)' },
      { id: 'name-arcane', name: 'Arcane', rarity: 'epic', gradient: 'linear-gradient(90deg,#818CF8,#C084FC,#22D3EE,#818CF8)' },
      { id: 'name-crystal', name: 'Crystalline', rarity: 'epic', gradient: 'linear-gradient(90deg,#67E8F9,#A5B4FC,#F0ABFC,#67E8F9)' },
      { id: 'name-dragon', name: 'Dragonfire', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626,#7F1D1D,#DC2626,#F97316)' },
      // Snapfam export (names/names.css) — Winter Party, Space Cadet, Street Art. art = přesně podle specs.csv:
      // slide = přechod 6 s jezdí sem a tam, edge = 1px světlejší horní hrana (legendary, bez záře).
      // name-aurora dřív existovalo jako Epic (starý přechod) — stejné id, teď nová definice.
      { id: 'name-snowy', name: 'Snowy', rarity: 'common', color: '#E3F2FF', art: true },
      { id: 'name-cranberry', name: 'Cranberry', rarity: 'common', color: '#FF6F86', art: true },
      { id: 'name-minty', name: 'Minty', rarity: 'rare', gradient: 'linear-gradient(90deg,#9FF5D0,#5ED8F0)', art: true },
      { id: 'name-gingerbread', name: 'Gingerbread', rarity: 'rare', gradient: 'linear-gradient(90deg,#F7B36B,#E08A4E)', art: true },
      { id: 'name-frosted', name: 'Frosted', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFFFFF,#BAE6FD,#60A5FA,#BAE6FD,#FFFFFF)', art: true, slide: true },
      { id: 'name-aurora', name: 'Aurora', rarity: 'epic', gradient: 'linear-gradient(90deg,#5EF2B5,#5EC8FF,#C9A2FF,#5EF2B5)', art: true, slide: true },
      { id: 'name-santa', name: 'Santa', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FF6B6B,#FFE9D6,#FF6B6B)', art: true, edge: '#FFE9D6' },
      { id: 'name-moon', name: 'Moon', rarity: 'common', color: '#D6DCE8', art: true },
      { id: 'name-comet', name: 'Comet', rarity: 'common', color: '#7FD3FF', art: true },
      { id: 'name-nebula', name: 'Nebula', rarity: 'rare', gradient: 'linear-gradient(90deg,#C9A2FF,#8FB0FF)', art: true },
      { id: 'name-mars', name: 'Mars', rarity: 'rare', gradient: 'linear-gradient(90deg,#FF8A5C,#FFB45C)', art: true },
      { id: 'name-supernova', name: 'Supernova', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFD23F,#FF8A5C,#FF6FB0,#FF8A5C,#FFD23F)', art: true, slide: true },
      { id: 'name-galaxy-far', name: 'Galaxy Far', rarity: 'epic', gradient: 'linear-gradient(90deg,#8FB0FF,#C9A2FF,#FF8FD8,#8FB0FF)', art: true, slide: true },
      { id: 'name-cosmic', name: 'Cosmic', rarity: 'legendary', gradient: 'linear-gradient(90deg,#5EF2B5,#5EC8FF,#C9A2FF,#FF8FD8,#FFD23F)', art: true, edge: '#5EF2B5' },
      { id: 'name-concrete', name: 'Concrete', rarity: 'common', color: '#C4C4CF', art: true },
      { id: 'name-spray', name: 'Spray', rarity: 'common', color: '#FF6FB4', art: true },
      { id: 'name-tag', name: 'Tag', rarity: 'rare', gradient: 'linear-gradient(90deg,#FF6FB4,#FFB45C)', art: true },
      { id: 'name-highlighter', name: 'Highlighter', rarity: 'rare', gradient: 'linear-gradient(90deg,#EEFF5C,#7DFF8A)', art: true },
      { id: 'name-fresh-kicks', name: 'Fresh Kicks', rarity: 'epic', gradient: 'linear-gradient(90deg,#5EC8FF,#EEFF5C,#5EC8FF)', art: true, slide: true },
      { id: 'name-wildstyle', name: 'Wildstyle', rarity: 'epic', gradient: 'linear-gradient(90deg,#FF6FB4,#FFD23F,#5EF2B5,#5EC8FF,#FF6FB4)', art: true, slide: true },
      { id: 'name-gold-chain', name: 'Gold Chain', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FFE38C,#E8B84A,#FFF1B8,#E8B84A)', art: true, edge: '#FFF1B8' },
      // jen z druhého dárkového odkazu (gift.js) — mythic, v žádné truhle ani na kole
      { id: 'name-jezevcik', name: 'Jezevčík', rarity: 'mythic', promoOnly: true, gradient: 'linear-gradient(90deg,#B88552,#D9A066,#F0C27A,#FBBF24,#E8B068,#B88552)' },
      // jen z třetího dárkového odkazu (gift.js) — mythic, v žádné truhle ani na kole
      { id: 'name-miku', name: 'Miku', rarity: 'mythic', promoOnly: true, gradient: 'linear-gradient(90deg,#14B8A6,#22D3EE,#5EEAD4,#F97316,#FDBA74,#22D3EE,#14B8A6)' },
      // jen z kola štěstí (wheel.js)
      { id: 'name-jackpot', name: 'Jackpot', rarity: 'epic', wheelOnly: true, gradient: 'linear-gradient(90deg,#FDE047,#4ADE80,#FDE047,#4ADE80)' },
    ],
  },
];

// Staré / přejmenované id → platné id (uložený inventář, nasazené věci i looks od ostatních hráčů).
// Při přejmenování skinu sem přidat řádek, ať se nic vlastněného neztratí.
const ITEM_ALIASES = { 'name-northern-lights': 'name-aurora' };
function resolveItemId(id) { return (id && ITEM_ALIASES[id]) || id; }

// Všechny věci v jednom seznamu, každá ví, do jaké sekce patří.
const ALL_ITEMS = SHOP_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.id })));

// Ceník — jeden kurz pro všechno: 120 mincí za €0.99 (≈ 121 mincí = 1 €).
// Větší balíčky mincí mají bonus navíc (+10/20/30 %), ať se vyplatí.
// Truhly stojí 50–250 mincí (≈ €0.40–2.10), dohraná hra dá 3–13 mincí, denně +30 zdarma.
const COIN_RATE_EUR = 0.99 / 120; // cena 1 mince v eurech (podle nejmenšího balíčku)

const COIN_PACKS = [
  { coins: 120, price: '€0.99', art: 'coin' },
  { coins: 670, price: '€4.99', bonus: 10, tag: 'Popular', art: 'pile' },
  { coins: 1450, price: '€9.99', bonus: 20, art: 'box' },
  { coins: 3150, price: '€19.99', bonus: 30, tag: 'Best value', art: 'safe' },
];

const NO_ADS_PRICE = '€2.99';

function formatEur(value) {
  return `€${value.toFixed(2)}`;
}

// V dev režimu je postup uložený zvlášť a mincí je pořád kolem milionu.
function shopKey() {
  return isDevMode() ? 'vyraz_shop_dev' : 'vyraz_shop';
}

function shopLoad() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(shopKey()) || 'null'); } catch { /* ignore */ }
  data = data || { coins: SHOP_START_COINS, owned: [], equipped: {} };
  // aliasy: přejmenovaná id se převedou na nová (bez duplicit)
  if (Array.isArray(data.owned)) data.owned = [...new Set(data.owned.map(resolveItemId))];
  if (data.equipped) for (const k of Object.keys(data.equipped)) data.equipped[k] = resolveItemId(data.equipped[k]);
  // nabídky byly zdarma omylem v prototypu, tak se odstraní od běžných hráčů (dev storage se nemění)
  if (!isDevMode() && data.unlocks) {
    const partyPackCoins = 200; // PARTY_PACK.coins z offers.js
    const questionPacksCoins = 100; // QUESTION_PACKS.coins z offers.js
    let coinsToRemove = 0;
    if (data.unlocks.includes('party-pack')) coinsToRemove += partyPackCoins;
    if (data.unlocks.includes('question-packs')) coinsToRemove += questionPacksCoins;
    data.unlocks = data.unlocks.filter(id => id !== 'party-pack' && id !== 'question-packs');
    if (coinsToRemove > 0) {
      data.coins = Math.max(0, data.coins - coinsToRemove);
      shopSave(data);
    }
  }
  if (isDevMode() && data.coins < DEV_COINS / 2) data.coins = DEV_COINS;
  // v dev režimu má vývojář vždycky všechny skiny (i nově přidané)
  if (isDevMode()) {
    const owned = new Set(data.owned || []);
    for (const s of SHOP_SECTIONS) for (const i of s.items) owned.add(i.id);
    data.owned = [...owned];
  }
  return data;
}

function shopSave(data) {
  try { localStorage.setItem(shopKey(), JSON.stringify(data)); } catch { /* ignore */ }
}

function coinBadgeHtml(coins) {
  return `<div class="coin-badge">${COIN_SVG}<span class="num">${coins}</span></div>`;
}

// big = velký náhled (odhalení výhry); jinak malý (mřížky, inventář) → u SVG rámečků malá varianta
function shopItemPreview(section, item, big = false) {
  if (section.id === 'frame') {
    const box = frameBox(item, big ? 110 : 54);
    return `<div class="frame-preview ${box.cls}" style="background:${box.bg}"><div class="frame-inner">${icon('camera')}</div>${frameDecorHtml(item, big ? 110 : 54)}</div>`;
  }
  const name = escapeHtml(getSavedName() || 'Name');
  return `<div class="name-preview"><span style="${nameStyleFor(item)}">${name}</span></div>`;
}

function sectionOf(item) {
  return SHOP_SECTIONS.find((s) => s.id === item.section);
}

// Shop záložka má dvě pod-obrazovky: samotný obchod a inventář.
let shopView = 'shop';

// Obchod je rozdělený do záložek, ať není jeden dlouhý seznam.
// Otevře se na „Free", když je co vyzvednout, jinak na truhlách.
const SHOP_TABS = [
  { id: 'free', label: 'Free', icon: 'gift' },
  { id: 'chests', label: 'Chests', icon: 'chest' },
  { id: 'packs', label: 'Packs', icon: 'star' }, // nabídky + mince + No ads
];
let shopTab = null;

function shopTabsHtml() {
  const dots = {
    free: anyDailyAvailable(),
    chests: CASES.some((c) => isCaseAvailable(c) && caseIsFree(c)),
  };
  return `<div class="sf-seg shop-seg" role="tablist" aria-label="Shop">${SHOP_TABS.map((t) => `
    <button class="sf-seg-btn ${t.id === shopTab ? 'on' : ''}" role="tab" aria-selected="${t.id === shopTab}" data-shop-tab="${t.id}">${t.label}${dots[t.id] ? '<i class="shop-tab-dot" aria-label="New"></i>' : ''}</button>`).join('')}</div>`;
}

// fromProfile = otevřeno z profilu (Edit look) — šipka zpět pak vede do menu, ne do obchodu
let inventoryFromProfile = false;
function openInventory(fromProfile = false) {
  inventoryFromProfile = fromProfile === true;
  shopView = 'inventory';
  renderShopScreen();
  window.scrollTo(0, 0);
}

function backToShop() {
  inventoryFromProfile = false;
  shopView = 'shop';
  renderShopScreen();
  window.scrollTo(0, 0);
}

function backToMenu() {
  inventoryFromProfile = false;
  shopView = 'shop';
  homeTab = 'games';
  renderStartScreen();
  window.scrollTo(0, 0);
}

function itemCountLabel(n) {
  return n === 1 ? '1 item' : `${n} items`;
}

function renderShopScreen() {
  if (shopView === 'inventory') return renderInventoryScreen();
  mountedKey = 'shop';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();
  if (!shopTab) shopTab = anyDailyAvailable() ? 'free' : 'chests';

  const availCases = CASES.filter((c) => isCaseAvailable(c));
  // hlavní truhla nahoře: ta s odpočtem, jinak nová
  const featured = availCases.find((c) => c.endsAt) || availCases.find((c) => c.isNew) || null;
  const caseCardHtml = (c, feature) => `
    <div class="case-card ${feature ? 'case-feature' : ''} ${c.isNew ? 'is-new' : ''}" data-case-card="${c.id}" style="--case-glow:${c.glow}">
      ${c.isNew ? '<span class="case-new-tag">NEW</span>' : ''}
      <div class="case-art">${caseSvg(c)}</div>
      <div class="case-card-info">
        <h3>${c.name}</h3>
        ${feature && c.endsAt ? `<div class="case-timer">${icon('timer')} ${caseTimeLeft(c)}</div>` : ''}
        ${feature && !c.endsAt && c.exclusive ? '<div class="case-timer is-plain">Exclusive skins</div>' : ''}
        <button class="case-open-btn ${caseIsFree(c, data) ? 'is-free' : 'is-paid'}" data-case="${c.id}">${casePriceHtml(c, data)}</button>
      </div>
    </div>`;
  const casesHtml = (featured ? caseCardHtml(featured, true) : '')
    + `<div class="case-grid">${availCases.filter((c) => c !== featured).map((c) => caseCardHtml(c, false)).join('')}</div>`;

  const packsHtml = COIN_PACKS.map((p) => `
    <button class="coin-pack" data-pack="${p.coins}">
      ${p.tag ? `<span class="coin-pack-tag">${p.tag}</span>` : ''}
      <span class="coin-pack-icon">${COIN_PACK_ART[p.art]}</span>
      <span class="coin-pack-info">
        <span class="coin-pack-amount num">${p.coins}</span>
        <span class="coin-pack-price">${p.price}</span>
        ${p.bonus ? `<span class="coin-pack-bonus">+${p.bonus}% extra</span>` : ''}
      </span>
    </button>
  `).join('');

  app.innerHTML = `
    <div class="home-top sf-page-top">
      <div class="brand"><h1>Shop</h1></div>
      ${coinBadgeHtml(data.coins)}
    </div>

    <div class="screen sf-shop">
      <button class="inventory-btn" id="inventory-btn">
        <div class="inventory-btn-icon">${icon('hanger')}</div>
        <div class="inventory-btn-text"><strong>Inventory</strong><span>${itemCountLabel(data.owned.length)}</span></div>
        <div class="inventory-btn-arrow">${icon('chevron')}</div>
      </button>

      ${shopTabsHtml()}

      <div class="shop-tab-body">
        ${shopTab === 'free' ? dailyRewardsHtml() + redeemCodeCardHtml() : ''}

        ${shopTab === 'chests' ? casesHtml : ''}

        ${shopTab === 'packs' ? `
          <div id="shop-pack">${partyPackCardHtml({ compact: true })}</div>
          <div id="shop-qpacks">${questionPacksCardHtml({ compact: true })}</div>

          <div class="section-eyebrow">COINS</div>
          <div class="coin-packs">
            ${packsHtml}
            <button class="no-ads-card" id="no-ads-btn">
              <div class="no-ads-icon">${NO_ADS_SVG}</div>
              <div class="no-ads-text"><strong>No ads</strong><span>Forever</span></div>
              <div class="no-ads-price">${NO_ADS_PRICE}</div>
            </button>
          </div>` : ''}
      </div>
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  document.getElementById('inventory-btn').onclick = () => openInventory();
  document.querySelectorAll('[data-shop-tab]').forEach((b) => {
    b.onclick = () => { shopTab = b.dataset.shopTab; playSfx('swipe'); renderShopScreen(); };
  });
  if (shopTab === 'free') { wireDailyRewards(); wireRedeemCode(); }
  if (shopTab === 'packs') {
    wirePackBuy(document.getElementById('shop-pack'), renderShopScreen);
    wireQuestionPacksBuy(document.getElementById('shop-qpacks'), renderShopScreen);
  }
  // truhla se po ťuknutí zatřese; zdarma se otevře hned, za mince se nejdřív ukáže okno s nákupem
  const shake = (card) => {
    const c = caseById(card.dataset.caseCard);
    chestTap(card.querySelector('.chest-art'), c); // stavy bounce / shake z exportu truhel
    playSfx('chest-shake');
  };
  // zavřené truhly se stáhnou předem po prvním vykreslení (zatřesení pak nic nezdrží)
  const featuredCase = featured || availCases[0];
  if (featuredCase) setTimeout(() => chestPreload(featuredCase, CHEST_SHAKE_SEQ), 400);
  document.querySelectorAll('.case-card').forEach((card) => {
    card.addEventListener('pointerdown', () => chestPreload(caseById(card.dataset.caseCard), CHEST_SHAKE_SEQ), { once: true });
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      shake(card);
      setTimeout(() => showCaseContents(card.dataset.caseCard), 350);
    });
  });
  document.querySelectorAll('.case-open-btn').forEach((btn) => {
    btn.onclick = () => {
      shake(btn.closest('.case-card'));
      const id = btn.dataset.case;
      setTimeout(() => (caseIsFree(caseById(id)) ? openCase(id) : showCaseContents(id)), 450);
    };
  });

  const notYet = () => showToast('Payments aren\'t live yet — this is a prototype.');
  document.querySelectorAll('.coin-pack').forEach((b) => { b.onclick = notYet; });
  const noAds = document.getElementById('no-ads-btn');
  if (noAds) noAds.onclick = notYet;
}

let toastTimer = null;
// kind: 'good' (zelený), 'danger' (červený), 'gold' (mince), jinak fialový. Bez kind se odhadne z textu.
function showToast(text, kind) {
  clearTimeout(toastTimer);
  if (!kind) {
    if (/not enough/i.test(text)) kind = 'gold';
    else if (/couldn|failed|denied|removed|lost connection/i.test(text)) kind = 'danger';
    else if (/copied|bought|let you in|developer mode on/i.test(text)) kind = 'good';
  }
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = `toast${kind ? ` toast-${kind}` : ''}`;
  el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
  const ico = kind === 'good' ? icon('check') : kind === 'danger' ? icon('alert') : '';
  const needCoins = kind === 'gold' && /not enough/i.test(text);
  el.innerHTML = `${ico}<span></span>${needCoins ? '<button type="button" class="toast-btn">Get coins</button>' : ''}`;
  el.querySelector('span').textContent = text;
  const getCoins = el.querySelector('.toast-btn');
  if (getCoins) {
    getCoins.onclick = () => {
      el.classList.remove('show');
      if (typeof lastState !== 'undefined' && lastState) return; // uprostřed hry se nepřepíná
      closeCaseOverlay();
      closeModal();
      shopTab = 'packs';
      shopView = 'shop';
      homeTab = 'shop';
      renderStartScreen();
    };
  }
  void el.offsetWidth; // ať se animace přehraje i při rychlém opakování
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ------------------------------------------------------------ INVENTÁŘ ---

function equippedItem(data, sectionId) {
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  return section.items.find((i) => i.id === resolveItemId(data.equipped[sectionId])) || null;
}

function nameStyleFor(item) {
  if (!item) return 'color:#fff;';
  // Snapfam export (art): přesně podle specs.csv — Common/Rare statické, Epic přechod jezdí 6 s (name-slide), Legendary
  // statický + 1px světlejší horní hrana (drop-shadow, protože text-shadow by přes průhledný text překryl přechod). Bez aury.
  if (item.art) {
    if (!item.gradient) return `color:${item.color};`;
    const base = `background:${item.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`;
    if (item.slide) return `${base} background-size:200% 100%; animation:name-slide 6s linear infinite;`;
    if (item.edge) return `${base} filter:drop-shadow(0 -1px 0 ${item.edge}80);`;
    return base;
  }
  if (item.gradient) {
    const base = `background:${item.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`;
    // mythic: plynule proudící přechod (bez bílé), tenký tmavě hnědý obrys pro čitelnost, žádná velká záře
    if (item.rarity === 'mythic') {
      return `${base} background-size:300% 100%; animation:name-shimmer 4.5s linear infinite alternate; filter:drop-shadow(0 1px 0 rgba(60,24,6,0.85));`;
    }
    // vzácné barvy jména se pomalu přelévají, epické a legendární rychleji a víc září
    if (item.rarity === 'epic' || item.rarity === 'legendary') {
      return `${base} background-size:220% 100%; animation:name-shimmer 3.5s ease-in-out infinite alternate; filter:drop-shadow(0 0 6px rgba(255,255,255,0.25));`;
    }
    return `${base} background-size:180% 100%; animation:name-shimmer 6s ease-in-out infinite alternate;`;
  }
  // obyčejné barvy jména: jedna plná barva, bez záře a animace
  return `color:${item.color};`;
}

// Náhled toho, jak tě uvidí ostatní — nasazený rámeček + barva jména + postup sbírky.
function looksPreviewHtml(data) {
  const frame = equippedItem(data, 'frame');
  const nameItem = equippedItem(data, 'name');
  const totalItems = ALL_ITEMS.length;
  const owned = data.owned.length;
  const pct = Math.round((owned / totalItems) * 100);
  const fr = frame ? `${frame.name} · <span style="color:${RARITIES[frame.rarity].color}">${RARITIES[frame.rarity].label}</span>` : 'Default';
  return `
    <div class="looks-card">
      <div class="looks-frame ${frameBox(frame, 112).cls}" style="background:${frameBox(frame, 112).bg}">
        <div class="looks-photo">${getAvatar() ? `<img class="avatar-img" src="${getAvatar()}" alt="">` : escapeHtml((getSavedName() || '?').charAt(0).toUpperCase())}</div>
        ${frameDecorHtml(frame, 112)}
      </div>
      <div class="looks-info">
        <div class="looks-name" style="${nameStyleFor(nameItem)}">${escapeHtml(getSavedName() || 'Name')}</div>
        <div class="looks-frame-line">Frame: ${fr}</div>
        <div class="looks-progress"><span class="num">${owned} of ${totalItems} skins</span><div class="profile-progress"><div style="width:${pct}%"></div></div></div>
      </div>
    </div>`;
}

let invTab = 'frame';

function inventoryTileHtml(section, item, equipped) {
  const rar = item ? RARITIES[item.rarity] : RARITIES.common;
  const preview = item
    ? (section.id === 'frame' ? shopItemPreview(section, item) : `<span class="inv-aa" style="${nameStyleFor(item)}">Aa</span>`)
    : section.id === 'frame'
      ? `<div class="frame-preview" style="background:var(--sf-r-common)"><div class="frame-inner">${icon('camera')}</div></div>`
      : `<span class="inv-aa" style="color:#fff">Aa</span>`;
  const label = item ? item.name : 'Default';
  return `
    <button class="inv-item ${equipped ? 'is-equipped' : ''}" data-section="${section.id}" data-id="${item ? item.id : ''}" aria-pressed="${equipped}" aria-label="${label}, ${rar.label}${equipped ? ', equipped' : ''}" style="--rc:${rar.color}">
      <span class="inv-preview">${preview}</span>
      <span class="inv-label">${label}</span>
      ${equipped ? `<span class="inv-check">${icon('check')}</span>` : ''}
    </button>`;
}

function inventoryLockedTileHtml(section, item) {
  const preview = section.id === 'frame'
    ? shopItemPreview(section, item)
    : `<span class="inv-aa" style="${nameStyleFor(item)}">Aa</span>`;
  return `
    <div class="inv-item is-locked" role="img" aria-label="${item.name}, ${RARITIES[item.rarity].label}, not owned" style="--rc:${RARITIES[item.rarity].color}">
      <span class="inv-preview">${preview}</span>
      <span class="inv-label">${item.name}</span>
    </div>`;
}

function renderInventoryScreen() {
  mountedKey = 'inventory';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();
  const section = SHOP_SECTIONS.find((x) => x.id === invTab) || SHOP_SECTIONS[0];
  const TAB_LABELS = { frame: 'Frames', name: 'Name colors' };

  // od nejvzácnější po nejběžnější; každá skupina má svou barvu A slovo vzácnosti
  const groupsHtml = ['mythic', 'legendary', 'epic', 'rare', 'common'].map((r) => {
    const items = section.items.filter((i) => i.rarity === r);
    if (!items.length && r !== 'common') return '';
    const ownedN = items.filter((i) => data.owned.includes(i.id)).length;
    const tiles = (r === 'common' ? [inventoryTileHtml(section, null, !data.equipped[section.id])] : [])
      .concat(items.map((item) => (data.owned.includes(item.id)
        ? inventoryTileHtml(section, item, data.equipped[section.id] === item.id)
        : inventoryLockedTileHtml(section, item))));
    return `
      <section class="inv-group">
        <h2 class="inv-group-title"><i style="background:${RARITIES[r].color}"></i>${RARITIES[r].label.toUpperCase()}<span>${ownedN}/${items.length}</span></h2>
        <div class="inv-grid">${tiles.join('')}</div>
      </section>`;
  }).join('');

  app.innerHTML = `
    <div class="home-top sf-page-top">
      <div class="lobby-top" style="margin-bottom:0">
        <button id="inv-back" class="back-btn" title="Back to shop" aria-label="Back">${icon('back')}</button>
        <div class="brand"><h1>Inventory</h1></div>
      </div>
      ${coinBadgeHtml(data.coins)}
    </div>

    <div class="screen sf-inventory">
      ${looksPreviewHtml(data)}
      ${data.owned.length === 0 ? `
        <div class="sf-empty">
          <svg viewBox="0 0 96 96" width="84" height="84" aria-hidden="true"><circle cx="48" cy="54" r="34" fill="#FFD23F" stroke="#8C6600" stroke-width="4"/><circle cx="48" cy="16" r="10" fill="#C2531B" stroke="#8C6600" stroke-width="4"/><circle cx="38" cy="52" r="4" fill="#3A2500"/><circle cx="58" cy="52" r="4" fill="#3A2500"/><ellipse cx="48" cy="68" rx="6" ry="4" fill="#3A2500"/></svg>
          <div class="sf-empty-text"><strong>No skins yet</strong><span>Open a chest to get your first frame.</span>
            <button class="btn btn-primary sf-empty-btn" id="inv-to-shop">Go to chests</button></div>
        </div>` : `
      <div class="sf-seg" role="tablist" aria-label="Skins">${SHOP_SECTIONS.map((x) => `
        <button class="sf-seg-btn ${x.id === section.id ? 'on' : ''}" role="tab" aria-selected="${x.id === section.id}" data-inv-tab="${x.id}">${TAB_LABELS[x.id] || x.title}</button>`).join('')}</div>
      ${groupsHtml}`}
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  // ťuknutí na "Shop" v liště z inventáře vrátí zpátky do obchodu
  document.querySelector('.bottom-nav-btn[data-tab="shop"]').onclick = backToShop;
  document.getElementById('inv-back').onclick = inventoryFromProfile ? backToMenu : backToShop;
  const toShop = document.getElementById('inv-to-shop');
  if (toShop) toShop.onclick = () => { shopTab = 'chests'; backToShop(); };
  document.querySelectorAll('[data-inv-tab]').forEach((b) => {
    b.onclick = () => { invTab = b.dataset.invTab; playSfx('swipe'); renderInventoryScreen(); };
  });

  document.querySelectorAll('button.inv-item').forEach((btn) => {
    btn.onclick = () => {
      const d = shopLoad();
      if (btn.dataset.id) d.equipped[btn.dataset.section] = btn.dataset.id;
      else delete d.equipped[btn.dataset.section];
      shopSave(d);
      sendHello(); // přátelé mají vidět nový vzhled hned
      renderInventoryScreen();
    };
  });

}
