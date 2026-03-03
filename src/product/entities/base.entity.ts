export abstract class BaseEntity {
  id!: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<BaseEntity>) {
    Object.assign(this, partial);
  }
}
