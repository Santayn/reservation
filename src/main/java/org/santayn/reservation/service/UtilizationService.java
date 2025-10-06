package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.web.dto.map.ClassroomLoadDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UtilizationService {

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public List<ClassroomLoadDto> utilizationByDateAndSlot(LocalDate date, Long slotId) {
        String sql = """
            with load_by_room as (
                select b.classroom_id,
                       coalesce(sum(g.persons_count), 0) as load
                from bookings b
                left join booking_groups bg on bg.booking_id = b.id
                left join groups g on g.id = bg.group_id
                where b.booking_date = ? and b.slot_id = ?
                group by b.classroom_id
            )
            select c.id as classroom_id,
                   c.name as classroom_name,
                   c.capacity as capacity,
                   coalesce(l.load, 0) as load
            from classrooms c
            left join load_by_room l on l.classroom_id = c.id
            order by c.name
            """;

        return jdbc.query(sql, (rs, row) -> mapRow(rs), date, slotId);
    }

    private ClassroomLoadDto mapRow(ResultSet rs) throws SQLException {
        long roomId = rs.getLong("classroom_id");
        String name = rs.getString("classroom_name");
        int capacity = rs.getInt("capacity");
        int load = rs.getInt("load");

        double util = capacity == 0 ? 0.0 : (double) load / (double) capacity;
        String badge = classify(util);

        return new ClassroomLoadDto(roomId, name, capacity, load, util, badge);
    }

    private String classify(double util) {
        if (util <= 0.0) return "util-empty";   // пусто
        if (util <= 0.25) return "util-25";     // до 25%
        if (util <= 0.5)  return "util-50";     // до 50%
        if (util <= 1.0)  return "util-100";    // ≤100%
        return "util-over";                     // >100%
    }
}
