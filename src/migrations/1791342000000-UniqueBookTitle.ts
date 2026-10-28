import type { MigrationInterface, QueryRunner } from 'typeorm';
export class UniqueBookTitle1791342000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE book ADD CONSTRAINT uq_book_title UNIQUE (title)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE book DROP INDEX uq_book_title');
  }
}
