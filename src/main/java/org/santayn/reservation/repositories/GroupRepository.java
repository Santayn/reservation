// org/santayn/reservation/repositories/GroupRepository.java
package org.santayn.reservation.repositories;
import org.santayn.reservation.models.group.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
public interface GroupRepository extends JpaRepository<Group, Integer> {
    Optional<Group> findByName(String name);


}
