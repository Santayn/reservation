// org/santayn/reservation/repositories/TeacherRepository.java
package org.santayn.reservation.repositories;
import org.santayn.reservation.models.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface TeacherRepository extends JpaRepository<User, Long> {
    Optional<User> findByLogin(String login);
}
