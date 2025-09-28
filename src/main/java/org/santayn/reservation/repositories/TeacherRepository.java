// org/santayn/reservation/repositories/TeacherRepository.java
package org.santayn.reservation.repositories;
import org.santayn.reservation.models.teacher.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TeacherRepository extends JpaRepository<Teacher, Long> {
    Optional<Teacher> findByLogin(String login);
}
