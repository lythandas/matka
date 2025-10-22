// src/utils/wikimedia.ts

export interface WikimediaImage {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

const WIKIMEDIA_IMAGES: WikimediaImage[] = [
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/b/b1/The_Great_Conjunction_of_Jupiter_and_Saturn_from_Namibia.jpg",
    alt: "The Great Conjunction of Jupiter and Saturn from Namibia",
    photographer: "Gerald Rhemann",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Gerald_Rhemann",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/e/e1/A_moment_of_silence_in_the_forest.jpg",
    alt: "A moment of silence in the forest",
    photographer: "Paolo Crosetto",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Paolo_Crosetto",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/e/e2/The_Eye_of_the_Dragon.jpg",
    alt: "The Eye of the Dragon",
    photographer: "Sergey P. Kurbatov",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Sergey_P._Kurbatov",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/The_Last_Breath.jpg",
    alt: "The Last Breath",
    photographer: "Luis Miguel Bugallo Sánchez",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Lmbuga",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/c/c7/The_Blue_Eye_of_Siberia.jpg",
    alt: "The Blue Eye of Siberia",
    photographer: "Alexey Kljatov",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Alexey_Kljatov",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/b/b2/The_Great_Wave_off_Kanagawa_%28coloured_version%29.jpg",
    alt: "The Great Wave off Kanagawa (coloured version)",
    photographer: "Katsushika Hokusai",
    photographerUrl: "https://commons.wikimedia.org/wiki/Creator:Katsushika_Hokusai",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/0/0b/The_Milky_Way_over_the_Alps.jpg",
    alt: "The Milky Way over the Alps",
    photographer: "Luca Vanzella",
    photographerUrl: "https://commons.wikimedia.org/wiki/User:Luca_Vanzella",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a7/The_Eye_of_Africa.jpg",
    alt: "The Eye of Africa",
    photographer: "NASA",
    photographerUrl: "https://commons.wikimedia.org/wiki/Category:Images_from_NASA",
  },
];

export const getRandomWikimediaImage = (): WikimediaImage | null => {
  if (WIKIMEDIA_IMAGES.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * WIKIMEDIA_IMAGES.length);
  return WIKIMEDIA_IMAGES[randomIndex];
};