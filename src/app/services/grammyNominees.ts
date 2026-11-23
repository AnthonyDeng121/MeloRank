export const grammyYear = '2027';
export const grammySource = 'https://www.grammy.com/awards/69th-annual-grammy-awards-2027/';

// Recording Academy's published nominee list, grouped by official category.
export const grammyCategories = [
  { id: 'album-of-the-year', title: '年度专辑', category: 'album', nominees: [
    ['Lost Weekend', 'Phoebe Bridgers'],
    ['The Art of Loving', 'Olivia Dean'],
    ['Dandelion', 'Ella Langley'],
    ['The Romantic', 'Bruno Mars'],
    ['THIS MUSIC MAY CONTAIN HOPE.', 'RAYE'],
    ['you seem pretty sad for a girl so in love', 'Olivia Rodrigo'],
    ['LUX (Complete Works)', 'ROSALÍA'],
    ['The Life of a Showgirl', 'Taylor Swift'],
  ] },
  { id: 'record-of-the-year', title: '年度录制', category: 'production', nominees: [
    ['Man I Need', 'Olivia Dean'],
    ["Choosin' Texas", 'Ella Langley'],
    ['I Just Might', 'Bruno Mars'],
    ['WHERE IS MY HUSBAND!', 'RAYE'],
    ['the cure', 'Olivia Rodrigo'],
    ['Berghain', 'ROSALÍA, Björk, Yves Tumor'],
    ['The Fate of Ophelia', 'Taylor Swift'],
    ['Dracula', 'Tame Impala With JENNIE'],
  ] },
  { id: 'song-of-the-year', title: '年度歌曲', category: 'song', nominees: [
    ['Berghain', 'ROSALÍA, Björk, Yves Tumor'],
    ["Choosin' Texas", 'Ella Langley'],
    ['the cure', 'Olivia Rodrigo'],
    ['hate that i made you love me', 'Ariana Grande'],
    ['I Knew It, I Knew You (from Toy Story 5)', 'Taylor Swift'],
    ['Man I Need', 'Olivia Dean'],
    ['Risk It All', 'Bruno Mars'],
    ['WHERE IS MY HUSBAND!', 'RAYE'],
  ] },
  { id: 'best-pop-solo-performance', title: '最佳流行个人表演', category: 'song', nominees: [
    ['Man I Need', 'Olivia Dean'],
    ['Risk It All', 'Bruno Mars'],
    ['WHERE IS MY HUSBAND!', 'RAYE'],
    ['the cure', 'Olivia Rodrigo'],
    ['Sauvignon Blanc', 'ROSALÍA'],
  ] },
  { id: 'best-pop-duo-group-performance', title: '最佳流行组合／合作表演', category: 'collaboration', nominees: [
    ['RUNWAY', 'Lady Gaga, Doechii'],
    ['Bring Your Love', 'Madonna, Sabrina Carpenter'],
    ['Click Clack Symphony.', 'RAYE Featuring Hans Zimmer'],
    ['The Life of a Showgirl', 'Taylor Swift, Sabrina Carpenter'],
    ['Dracula', 'Tame Impala, JENNIE'],
  ] },
  { id: 'best-pop-vocal-album', title: '最佳流行演唱专辑', category: 'album', nominees: [
    ['The Art of Loving', 'Olivia Dean'],
    ['petal', 'Ariana Grande'],
    ['The Romantic', 'Bruno Mars'],
    ['THIS MUSIC MAY CONTAIN HOPE.', 'RAYE'],
    ['you seem pretty sad for a girl so in love', 'Olivia Rodrigo'],
  ] },
] as const;
