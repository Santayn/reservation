// org/santayn/reservation/service/AuthTeacherService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthTeacherService {

    private final UserRepository userRepository;

    /** Логин из SecurityContext. */
    public String currentLogin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Пользователь не аутентифицирован");
        }
        return auth.getName();
    }

    /** Возвращает ID пользователя-преподавателя (user.isAdmin == false). */
    public Long currentTeacherId() {
        String login = currentLogin();
        User user = userRepository.findByLoginIgnoreCase(login)
                .orElseThrow(() -> new IllegalStateException("Пользователь не найден: " + login));
        if (user.isAdmin()) {
            throw new IllegalStateException("У администратора нет персонального расписания преподавателя");
        }
        return user.getId();
    }
}
