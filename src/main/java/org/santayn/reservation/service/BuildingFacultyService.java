package org.santayn.reservation.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.models.building.BuildingFaculty;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.repositories.BuildingFacultyRepository;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.web.dto.building.BuildingDto;
import org.santayn.reservation.web.dto.faculty.FacultyDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class BuildingFacultyService {

    private final BuildingFacultyRepository linkRepo;
    private final BuildingRepository buildingRepo;
    private final FacultyRepository facultyRepo;

    /**
     * Создаёт связь "корпус — факультет". Идемпотентно.
     */
    public void map(Long buildingId, Long facultyId) {
        Building building = buildingRepo.findById(buildingId)
                .orElseThrow(() -> new IllegalArgumentException("Корпус не найден: id=" + buildingId));
        Faculty faculty = facultyRepo.findById(facultyId)
                .orElseThrow(() -> new IllegalArgumentException("Факультет не найден: id=" + facultyId));

        BuildingFaculty.Id id = new BuildingFaculty.Id(buildingId, facultyId);
        if (linkRepo.existsById(id)) {
            return; // уже связаны — ничего не делаем
        }

        BuildingFaculty link = BuildingFaculty.builder()
                .id(id)                // ВАЖНО: задаём embedded id, иначе NPE в Hibernate
                .building(building)    // @MapsId("buildingId") синхронизирует FK
                .faculty(faculty)      // @MapsId("facultyId") синхронизирует FK
                .build();

        linkRepo.save(link);
    }

    /**
     * Удаляет связь. Идемпотентно.
     */
    public void unmap(Long buildingId, Long facultyId) {
        linkRepo.deleteById_BuildingIdAndId_FacultyId(buildingId, facultyId);
    }

    /**
     * Список факультетов, назначенных корпусу.
     */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<FacultyDto> listFacultiesByBuilding(Long buildingId) {
        buildingRepo.findById(buildingId)
                .orElseThrow(() -> new IllegalArgumentException("Корпус не найден: id=" + buildingId));

        return linkRepo.findAllById_BuildingId(buildingId).stream()
                .map(link -> new FacultyDto(
                        link.getFaculty().getId(),
                        link.getFaculty().getName()
                ))
                .toList();
    }

    /**
     * Список корпусов, назначенных факультету.
     */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<BuildingDto> listBuildingsByFaculty(Long facultyId) {
        facultyRepo.findById(facultyId)
                .orElseThrow(() -> new IllegalArgumentException("Факультет не найден: id=" + facultyId));

        return linkRepo.findAllById_FacultyId(facultyId).stream()
                .map(link -> new BuildingDto(
                        link.getBuilding().getId(),
                        link.getBuilding().getName()
                ))
                .toList();
    }
}
