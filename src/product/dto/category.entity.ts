export class CategoryEntity {
  id!: string;
  slug!: string;
  name!: string;
  description!: string | null;
  parentId!: string | null;
  level!: number;
  sortOrder!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<CategoryEntity>) {
    Object.assign(this, partial);
  }
}
