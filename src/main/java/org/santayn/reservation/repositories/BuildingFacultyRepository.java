package org.santayn.reservation.repositories;

import org.santayn.reservation.models.building.BuildingFaculty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BuildingFacultyRepository extends JpaRepository<BuildingFaculty, BuildingFaculty.Id> {

    boolean existsById(BuildingFaculty.Id id);

    List<BuildingFaculty> findAllById_BuildingId(Long buildingId);

    List<BuildingFaculty> findAllById_FacultyId(Long facultyId);

    void deleteById_BuildingIdAndId_FacultyId(Long buildingId, Long facultyId);
}
