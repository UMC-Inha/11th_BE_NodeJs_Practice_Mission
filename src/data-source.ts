import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Book } from './book.entity.js';
import { Category } from './category.entity.js';
import { UniqueBookTitle1791342000000 } from './migrations/1791342000000-UniqueBookTitle.js';
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'umc_week04_library',
  entities: [Book, Category],
  migrations: [UniqueBookTitle1791342000000],
  synchronize: false,
});
