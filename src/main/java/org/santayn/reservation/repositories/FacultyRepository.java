// org/santayn/reservation/repositories/FacultyRepository.java
package org.santayn.reservation.repositories;
import org.santayn.reservation.models.faculty.Faculty;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface FacultyRepository extends JpaRepository<Faculty, Long> {
    Optional<Faculty> findByName(String name);
}
