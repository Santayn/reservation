package org.santayn.reservation.bootstrap;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepo;
    private final FacultyRepository facultyRepo;
    private final PasswordEncoder encoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 1) Базовый факультет
        Faculty base = facultyRepo.findByName("Базовый")
                .orElseGet(() -> facultyRepo.save(Faculty.builder().name("Базовый").build()));

        // 2) Админ (login=admin)
        userRepo.findByLogin("admin").orElseGet(() ->
                userRepo.save(User.builder()
                        .login("admin")
                        .passwordHash(encoder.encode("admin123"))
                        .admin(true)
                        .faculty(base) // задаём факультет
                        .build())
        );

        // 3) Пример преподавателя (не админ)
        userRepo.findByLogin("teacher").orElseGet(() ->
                userRepo.save(User.builder()
                        .login("teacher")
                        .passwordHash(encoder.encode("teacher123"))
                        .admin(false)
                        .faculty(base)
                        .build())
        );
    }
}
