// org/santayn/reservation/web/dto/user/UserMeDto.java
package org.santayn.reservation.web.dto.user;

public record UserMeDto(
        Long id,
        String firstName,
        String lastName,
        String login,
        String email, // оставим на будущее, можно будет убрать
        String role
) {}
