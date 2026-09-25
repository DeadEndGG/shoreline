/** Ownership notice shown on the sign-in page, sidebar and guest pass. */
export const OWNERSHIP = {
  company: 'Long Island Data',
  preparedFor: 'Jon Hodge',
  year: 2026,
  get line() {
    return `© ${this.year} ${this.company} · Prototype prepared for ${this.preparedFor} · Confidential`;
  },
};
