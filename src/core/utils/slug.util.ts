/**
 * Formats a string into a URL-friendly slug.
 * @param text - The text to convert.
 * @returns {string} The formatted slug.
 */
const formatSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // Convert spaces to hyphens
    .replace(/[^a-z0-9-]+/g, '') // Remove special characters
    .replace(/^-+|-+$/g, ''); // Trim hyphens
};

/**
 * Generates a unique slug by checking the database for duplicates.
 * @param title - The title to convert into a slug.
 * @param username - The username to enhance uniqueness.
 * @param checkSlugExists - A function that checks the database for slug existence.
 * @returns {Promise<string>} The generated unique slug.
 */
export const generateUniqueSlug = async (
  title: string,
  username: string,
  checkSlugExists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const baseSlug = formatSlug(title);
  const userSlug = formatSlug(username);

  let slug = `${baseSlug}-${userSlug}`;

  let count = 2;
  while (await checkSlugExists(slug)) {
    slug = `${baseSlug}-${userSlug}-${count}`;
    count++;
  }

  return slug;
};
