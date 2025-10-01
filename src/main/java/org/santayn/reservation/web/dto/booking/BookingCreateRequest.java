package org.santayn.reservation.web.dto.booking;

import lombok.Data;

import java.util.List;

@Data
public class BookingCreateRequest {
    private Long slotID;
    private List<Integer> groupIDs;
    private String comment;
}
