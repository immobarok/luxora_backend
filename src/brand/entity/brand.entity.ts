export class BrandEntity {
  id!: string;
  slug!: string;
  name!: string;
  description!: string | null;
  logoUrl!: string | null;
  website!: string | null;
  isVerified!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<BrandEntity>) {
    Object.assign(this, partial);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      logoUrl: this.logoUrl,
      website: this.website,
      isVerified: this.isVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
