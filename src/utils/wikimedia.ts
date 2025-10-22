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
    // Step 1: Get a list of image titles from the 'Landscape photographs' category
    // Add a cache-busting timestamp to ensure a fresh list is fetched
    const cacheBuster = Date.now();
    const categoryResponse = await fetch(
      `${WIKIMEDIA_API_URL}?action=query&generator=categorymembers&gcmtitle=Category:Landscape_photographs&gcmlimit=500&format=json&origin=*&cb=${cacheBuster}`
    );
    const categoryData = await categoryResponse.json();

    if (!categoryData.query || !categoryData.query.pages) {
      console.warn("No landscape images found in category from Wikimedia API.");
      return null;
    }

    const pages = Object.values(categoryData.query.pages) as any[];
    const imageTitles = pages
      .filter(page => page.title.startsWith('File:')) // Ensure it's an image file
      .map(page => page.title);

    if (imageTitles.length === 0) {
      console.warn("No suitable image titles found after filtering.");
      return null;
    }

    // Pick a random image title from the fetched list
    const randomTitle = imageTitles[Math.floor(Math.random() * imageTitles.length)];

    // Step 2: Get image information and a scaled URL for the selected image
    // iiurlwidth=1920 requests a thumbnail with a maximum width of 1920px
    const imageInfoResponse = await fetch(
      `${WIKIMEDIA_API_URL}?action=query&titles=${encodeURIComponent(randomTitle)}&prop=imageinfo&iiprop=url|user|comment|extmetadata&iiurlwidth=1920&format=json&origin=*&cb=${cacheBuster}`
    );
    const imageInfoData = await imageInfoResponse.json();

    if (!imageInfoData.query || !imageInfoData.query.pages) {
      console.warn("Failed to get image info for selected title from Wikimedia API.");
      return null;
    }

    const imagePage = Object.values(imageInfoData.query.pages)[0] as any;
    const imageInfo = imagePage.imageinfo?.[0];

    if (!imageInfo || !imageInfo.thumburl) {
      console.warn("No thumbnail URL found for the selected image.");
      return null;
    }

    // Extract photographer and alt text from extmetadata if available, or fallback
    const extMetadata = imageInfo.extmetadata;
    const photographer = extMetadata?.Artist?.value?.replace(/<[^>]*>?/gm, '') || imageInfo.user || "Unknown";
    const photographerUrl = extMetadata?.Artist?.value?.includes('href="')
      ? extMetadata.Artist.value.match(/href="([^"]*)"/)?.[1]
      : `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(imageInfo.user)}`;
    const alt = extMetadata?.ImageDescription?.value?.replace(/<[^>]*>?/gm, '') || imageInfo.comment || imagePage.title.replace('File:', '').replace(/_/g, ' ');

    return {
      url: imageInfo.thumburl, // Use the scaled thumbnail URL
      alt: alt,
      photographer: photographer,
      photographerUrl: photographerUrl || "https://commons.wikimedia.org/wiki/Main_Page",
    };
  } catch (error) {
    console.error("Error fetching random Wikimedia landscape image:", error);
    return null;
  }
};