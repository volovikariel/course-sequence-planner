const courseScheduleInfo = {
  COMP248: {
    courseName: "Object-Oriented Programming 1",
    courseCode: "COMP248",
    startTime: "10:00",
    endTime: "18:30",
    mon: true,
    tue: false,
    wed: true,
    thu: false,
    fri: false,
  },
  COMP249: {
    courseName: "Object-Oriented Programming 2",
    courseCode: "COMP249",
    startTime: "13:30",
    endTime: "15:30",
    mon: true,
    tue: false,
    wed: true,
    thu: false,
    fri: false,
  },
};

// How do I use this to modify the css 
const colors = ["#ff0000", "#d1a94c", "#118ab2", "#06d6a0"];

function getCourseSchedule(courseCode) {
  return courseScheduleInfo[courseCode];
}

function translateDay(courseCode) {
  // format weekday bools to numbers for timeslots
  let course = getCourseSchedule(courseCode);
  let weekdays = [course.mon, course.tue, course.wed, course.thu, course.fri];
  let weekdaysNum = [];
  for (let i = 0; i < weekdays.length; i++) {
    if (weekdays[i] == true) {
      weekdaysNum.push(i);
    }
  }
  return weekdaysNum;
}

function translateTime(hhmm) {
  // Format time to numbers for 'slices' of timeslots, goes from 9am to 630pm (9.5 hours) in 30min intervals,
  // Meaning that 9 is the first timeslot = 0 , 9:30 => 1, 9:45 => 1.5, 10 => 2, etc.
  let hours = parseInt(hhmm.split(":")[0]);
  let minutes = parseInt(hhmm.split(":")[1]) / 60;
  let time = hours + minutes;
  let x;

  if (time < 18) {
    x = (time % 9) * 2;
  } else x = (time % 9) * 2 + 18;
  return x;
}

function translateTimeForSlots(courseCode) {
  let course = getCourseSchedule(courseCode);
  let timeSlotStart = translateTime(course.startTime);
  let timeSlotEnd = translateTime(course.endTime);
  return [timeSlotStart, timeSlotEnd];
}

function addSelectedCourseToSchedule(courseCode) {
  // Add the selected course to the schedule
  let course = getCourseSchedule(courseCode);
  let days = translateDay(courseCode);
  let times = translateTimeForSlots(courseCode);
  let startTime = times[0];
  let endTime = times[1];

  for (let i = 0; i < days.length; i++) {
    let day = days[i];

    // Add the course to the schedule
    document.getElementById("courses").innerHTML += ` 
        style="
        --day: "${day}"; 
        --timeslot-start: "${startTime}";
        --timeslot-end: "${endTime}"; 
        --course-length: calc(var(--timeslot-end) - var(--timeslot-start));
        --indexed-timeslot-start: calc(var(--timeslot-start) - 1); /* 1-indexing it */
        height: calc(var(--timeslot-height) * var(--course-length)); 
        left: calc(var(--column-width) * var(--day));
        top: calc(var(--timeslot-height) * var(--timeslot-start))"
        "${course.courseCode}`;
  }
}

// Lets say they selected 248 and 249
addSelectedCourseToSchedule("COMP248");
addSelectedCourseToSchedule("COMP249");
