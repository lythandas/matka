// src/utils/wikimedia.ts

export interface WikimediaImage {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";

export const fetchRandomWikimediaLandscapeImage = async (): Promise<WikimediaImage | null> => {
  try {
    // Search for images with "landscape" in their title or description
    const searchResponse = await fetch(
      `${WIKIMEDIA_API_URL}?action=query&list=allimages&aifrom=Landscape&aiprop=url|user|comment&ailimit=500&format=json&origin=*`
    );
    const searchData = await searchResponse.json();

    if (!searchData.query || !searchData.query.allimages || searchData.query.allimages.length === 0) {
      console.warn("No landscape images found from Wikimedia API.");
      return null;
    }

    // Filter for images that have a direct URL and are likely suitable
    const suitableImages = searchData.query.allimages.filter(
      (img: any) => img.url && img.url.match(/\.(jpeg|jpg|png|gif|webp)$/i)
    );

    if (suitableImages.length === 0) {
      console.warn("No suitable landscape images found after filtering.");
      return null;
    }

    // Pick a random image from the suitable ones
    const randomIndex = Math.floor(Math.random() * suitableImages.length);
    const selectedImage = suitableImages[randomIndex];

    // Construct the photographer URL (Wikimedia user page)
    const photographerUrl = `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(selectedImage.user)}`;

    return {
      url: selectedImage.url,
      alt: selectedImage.comment || selectedImage.title || "Wikimedia landscape image",
      photographer: selectedImage.user || "Unknown",
      photographerUrl: photographerUrl,
    };
  } catch (error) {
    console.error("Error fetching random Wikimedia landscape image:", error);
    return null;
  }
};

// Removed getRandomWikimediaImage as it's no longer needed