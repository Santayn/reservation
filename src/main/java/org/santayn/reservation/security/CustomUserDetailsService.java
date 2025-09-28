package org.santayn.reservation.security;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.models.teacher.Teacher;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.repositories.TeacherRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepo;
    private final TeacherRepository teacherRepo;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // 1) пробуем пользователя по email
        User u = userRepo.findByEmail(username).orElse(null);
        if (u != null) {
            List<GrantedAuthority> auth =
                    List.of(new SimpleGrantedAuthority(u.isAdmin() ? "ROLE_ADMIN" : "ROLE_USER"));
            return new org.springframework.security.core.userdetails.User(
                    u.getEmail(), u.getPasswordHash(), auth
            );
        }
        // 2) пробуем преподавателя по login
        Teacher t = teacherRepo.findByLogin(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        List<GrantedAuthority> auth = List.of(new SimpleGrantedAuthority("ROLE_TEACHER"));
        return new org.springframework.security.core.userdetails.User(
                t.getLogin(), t.getPasswordHash(), auth
        );
    }
}
