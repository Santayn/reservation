package org.santayn.reservation.repositories;

import org.santayn.reservation.models.group.GroupTeacher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupTeacherRepository extends JpaRepository<GroupTeacher, GroupTeacher.Id> {

    boolean existsByTeacher_IdAndGroup_Id(Long teacherId, Long groupId);

    List<GroupTeacher> findByTeacher_Id(Long teacherId);

    void deleteByTeacher_IdAndGroup_Id(Long teacherId, Long groupId);
}
