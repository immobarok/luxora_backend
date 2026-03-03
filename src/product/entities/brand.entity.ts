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
}
