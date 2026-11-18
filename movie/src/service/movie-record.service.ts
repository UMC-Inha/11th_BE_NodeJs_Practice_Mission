import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateMovieRecordDto } from '../dto/create-movie-record.dto.js';
import { FavoriteResponseDto } from '../dto/favorite-response.dto.js';
import { MovieRecordResponseDto } from '../dto/movie-record-response.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { Favorite } from '../entity/favorite.entity.js';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import {
  favoriteDuplicated,
  memberNotFound,
  ratingDuplicated,
} from '../exception/api.exception.js';

/**
 * "영화를 보고 평점을 남기면서 즐겨찾기에도 넣기" 라는 한 가지 사용자 행동을 처리한다.
 *
 * RatingService.create() 와 FavoriteService.create() 를 연달아 부르면 안 된다.
 * 각자 따로 저장(따로 커밋)하기 때문에, 평점은 저장됐는데 즐겨찾기가 실패하면 평점만 남는다.
 * 그래서 이 한 행동 전용 Service 에서 두 저장을 하나의 트랜잭션으로 묶는다.
 */
@Injectable()
export class MovieRecordService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    memberId: number,
    dto: CreateMovieRecordDto,
  ): Promise<MovieRecordResponseDto> {
    // 콜백이 정상적으로 끝나면 commit, 예외가 밖으로 나가면 rollback 한다.
    return this.dataSource.transaction(async (manager) => {
      // 이 콜백 안에서는 manager 로 만든 Repository 만 쓴다. 주입받아 둔 Repository 를 섞어 쓰면
      // 같은 트랜잭션 연결을 쓴다는 보장이 없어서, 일부 저장이 롤백되지 않을 수 있다.
      const memberRepository = manager.getRepository(Member);
      const ratingRepository = manager.getRepository(Rating);
      const favoriteRepository = manager.getRepository(Favorite);

      const member = await memberRepository.findOneBy({ memberId });
      if (!member) {
        throw memberNotFound();
      }

      const existingRating = await ratingRepository.exists({
        where: { member: { memberId }, movieId: dto.movieId },
      });
      if (existingRating) {
        throw ratingDuplicated();
      }

      if (dto.addToFavorites) {
        const existingFavorite = await favoriteRepository.exists({
          where: { member: { memberId }, movieId: dto.movieId },
        });
        if (existingFavorite) {
          throw favoriteDuplicated();
        }
      }

      const savedRating = await ratingRepository.save(
        ratingRepository.create({
          member,
          movieId: dto.movieId,
          score: dto.score,
          comment: dto.comment ?? null,
        }),
      );

      // 여기서 실패하면(예: 그 사이 다른 요청이 같은 즐겨찾기를 넣어 UNIQUE 위반) 위의 평점 저장도 취소된다.
      let favorite: FavoriteResponseDto | null = null;
      if (dto.addToFavorites) {
        const savedFavorite = await favoriteRepository.save(
          favoriteRepository.create({ member, movieId: dto.movieId }),
        );
        favorite = FavoriteResponseDto.from(savedFavorite);
      }

      return MovieRecordResponseDto.of(
        RatingResponseDto.from(savedRating),
        favorite,
      );
    });
  }
}
