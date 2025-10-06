package org.santayn.reservation.repositories;

import org.santayn.reservation.models.group.Group;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupRepository extends JpaRepository<Group, Long> {
}
