import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * (선택 미션) 형식이 틀린 값은 DB에서 중복 여부를 보기 전에 400으로 돌려보낸다.
 * 6주차 회원가입 검증의 맛보기.
 */
export class NicknameParamDto {
  @Length(2, 12, { message: '닉네임은 2~12자로 입력해 주세요.' })
  nickname: string;
}

export class EmailParamDto {
  @MaxLength(254, { message: '이메일은 254자 이하로 입력해 주세요.' })
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  email: string;
}

/**
 * (선택 미션) GET /members/{memberId}/ratings?page=0&size=10
 * page, size 를 둘 다 생략하면 명세대로 전체 목록을 준다.
 * 하나라도 보내면 page 기본값 0, size 기본값 10 으로 잘라서 준다.
 */
export class RatingPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page는 0 이상의 정수여야 합니다.' })
  @Min(0, { message: 'page는 0 이상의 정수여야 합니다.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'size는 1~50 사이 정수여야 합니다.' })
  @Min(1, { message: 'size는 1~50 사이 정수여야 합니다.' })
  @Max(50, { message: 'size는 1~50 사이 정수여야 합니다.' })
  size?: number;
}
