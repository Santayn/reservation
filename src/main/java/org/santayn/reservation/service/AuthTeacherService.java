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

    /** Текущий пользователь (и админ, и препод). */
    public User currentUser() {
        String login = currentLogin();
        return userRepository.findByLoginIgnoreCase(login)
                .orElseThrow(() -> new IllegalStateException("Пользователь не найден: " + login));
    }

    /** Текущий пользователь — админ? */
    public boolean isAdmin() {
        return currentUser().isAdmin();
    }

    /** ID текущего пользователя, если он препод (isAdmin=false). */
    public Long currentTeacherId() {
        User user = currentUser();
        if (user.isAdmin()) {
            throw new IllegalStateException("У администратора нет персонального расписания преподавателя");
        }
        return user.getId();
    }
}
