package org.santayn.reservation.repositories;

import org.santayn.reservation.models.group.GroupFaculty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupFacultyRepository extends JpaRepository<GroupFaculty, GroupFaculty.Id> {

    List<GroupFaculty> findByGroup_Id(Long groupId);

    boolean existsByGroup_IdAndFaculty_Id(Long groupId, Long facultyId);

    void deleteByGroup_IdAndFaculty_Id(Long groupId, Long facultyId);
}
