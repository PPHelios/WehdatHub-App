import Share from 'react-native-share';

/** A picture's address turned into inline data, which the share sheet accepts on both Android and iPhone. */
async function toDataUri(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

/** Sends up to 10 of a unit's photos with its description through the phone's share sheet (WhatsApp or any app). */
export async function sharePhotos(urls: string[], message: string): Promise<'sent' | 'cancelled' | 'failed'> {
  try {
    const urlsData = await Promise.all(urls.slice(0, 10).map(toDataUri));
    await Share.open({ urls: urlsData, message, failOnCancel: false });
    return 'sent';
  } catch (e) {
    return e instanceof Error && /cancel|dismiss/i.test(e.message) ? 'cancelled' : 'failed';
  }
}
