// src/main/java/org/santayn/reservation/bootstrap/DataInitializer.java
package org.santayn.reservation.bootstrap;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.models.teacher.Teacher;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.repositories.TeacherRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {
    private final UserRepository userRepo;
    private final TeacherRepository teacherRepo;
    private final FacultyRepository facultyRepo;
    private final PasswordEncoder encoder;

    @Override
    public void run(ApplicationArguments args) {
        userRepo.findByEmail("admin@local").orElseGet(() ->
                userRepo.save(User.builder()
                        .email("admin@local")
                        .fullName("Администратор")
                        .passwordHash(encoder.encode("admin123"))
                        .admin(true)
                        .build())
        );

        var fac = facultyRepo.findByName("Базовый")
                .orElseGet(() -> facultyRepo.save(Faculty.builder().name("Базовый").build()));

        teacherRepo.findByLogin("teacher").orElseGet(() ->
                teacherRepo.save(Teacher.builder()
                        .fullName("Иванов Иван")
                        .login("teacher")
                        .passwordHash(encoder.encode("teacher123"))
                        .faculty(fac)
                        .build())
        );
    }
}
