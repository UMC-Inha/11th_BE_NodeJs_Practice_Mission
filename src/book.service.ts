import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, QueryFailedError, Repository } from 'typeorm';
import { Book } from './book.entity.js';
import { Category } from './category.entity.js';
import { BookResponseDto, CreateBookDto } from './book.dto.js';
@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book) private readonly books: Repository<Book>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}
  async getAllBooks(keyword?: string): Promise<BookResponseDto[]> {
    const search = keyword?.trim();
    // LIKE 와일드카드도 일반 검색 문자로 처리한다. 값은 ORM이 바인딩한다.
    const escaped = search?.replace(/[\\%_]/g, '\\$&');
    const books = await this.books.find({
      where: escaped ? { title: Like(`%${escaped}%`) } : {},
      relations: { category: true },
      order: { bookId: 'DESC' },
    });
    return books.map((book) => BookResponseDto.from(book));
  }
  async getBooksByCategory(categoryId: number): Promise<BookResponseDto[]> {
    const books = await this.books.find({
      where: { category: { categoryId: String(categoryId) } },
      relations: { category: true },
      order: { bookId: 'DESC' },
    });
    return books.map((book) => BookResponseDto.from(book));
  }
  async createBook(dto: CreateBookDto): Promise<BookResponseDto> {
    const category = await this.categories.findOneBy({
      categoryId: String(dto.categoryId),
    });
    if (!category) throw new NotFoundException('존재하지 않는 카테고리입니다.');
    const book = this.books.create({
      category,
      title: dto.title,
      description: dto.description ?? null,
      isAvailable: true,
    });
    try {
      return BookResponseDto.from(await this.books.save(book));
    } catch (error) {
      // 사전 조회만으로는 동시 중복 등록을 막을 수 없어 DB UNIQUE를 사용한다.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('이미 등록된 도서 제목입니다.');
      }
      throw error;
    }
  }
}
