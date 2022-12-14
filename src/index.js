/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-loop-func */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-prototype-builtins */
import {
  setupNodegraph, courseInformationByCourseId, scrollCourseIntoView, handleTermIcons,
} from './nodegraph.js';
import {
  getCourseSchedule, intersectSchedules, isCourseOffered, loadCourseSchedules, getTermOfferings,
} from './schedule.js';

let mouseX = 0;
let mouseY = 0;
const errorFadeInOutDuration = Number(
  window
    .getComputedStyle(document.body)
    .getPropertyValue('--fade-in-out-duration')
    .replace('s', ''),
);
function showError(msg) {
  if (document.getElementById('error')) {
    document.getElementById('error').remove();
  }
  const errorElement = document.createElement('div');
  errorElement.id = 'error';
  errorElement.innerText = msg;
  errorElement.style.top = `${mouseY}px`;
  errorElement.style.left = `${mouseX}px`;
  document.getElementById('node-graph-container').appendChild(errorElement);
  setTimeout(() => {
    errorElement.remove();
  }, errorFadeInOutDuration * 1000);
}

const universityDatabase = {
  'Concordia University': {
    'Computer Science': {
      creditRequirements: {
        'Computer science core': {
          completed: 0,
          need: 33,
        },
        'Complementary core': {
          completed: 0,
          need: 6,
        },
        'Computer science electives': {
          completed: 0,
          need: 18,
        },
        'Mathematics electives': {
          completed: 0,
          need: 6,
        },
        'Minor and general electives': {
          completed: 0,
          need: 27,
        },
      },
      courses: ['COMP248', 'COMP249'],
    },
  },
  'McGill University': {
    'Computer Science': {
      requirement1: '',
    },
    'Software Engineering': {
      requirement1: '',
    },
  },
};

export let currYear = 2022;
export let currTerm = 'fall';
class Student {
  constructor(
    university,
    program,
    futureCourses = { [currYear]: { [currTerm]: new Set() } },
    desiredCourses = new Set(),
    otherRequirementCompletion = new Set(),
    schedules = { [currYear]: { [currTerm]: [] } },
  ) {
    const universities = Object.keys(universityDatabase);
    if (!universities.includes(university)) throw new Error('invalid university passed in');
    this.university = university;

    const universityPrograms = new Set(Object.keys(universityDatabase[university]));
    if (!universityPrograms.has(program)) throw new Error('invalid program passed in');
    this.program = program;

    this.futureCourses = futureCourses;
    this.desiredCourses = desiredCourses;
    this.otherRequirementCompletion = otherRequirementCompletion;
    this.schedules = schedules;
    loadCourseSchedules(
      schedules[currYear][currTerm],
      Array.from(this.futureCourses[currYear][currTerm]),
    );
  }

  setSchedules(schedules, year, term) {
    this.schedules[year][term] = schedules;
    if (!Object.hasOwn(this.futureCourses, currYear)
    || !Object.hasOwn(this.futureCourses[currYear], currTerm)) {
      this.futureCourses[currYear] = {
        [currTerm]: new Set(),
        ...this.futureCourses[currYear],
      };
    }
    loadCourseSchedules(
      this.schedules[year][term],
      Array.from(this.futureCourses[currYear][currTerm]),
    );
  }

  isCourseReqForFutureCourses(course) {
    // Courses that depend on this course
    const dependantCourses = [];
    Object.entries(courseInformationByCourseId).forEach(([courseId, courseInfo]) => {
      if (courseInfo.prereqs.concat(courseInfo.coreqs).includes(course)) {
        dependantCourses.push(courseId);
      }
    });

    for (const dependantcourse of dependantCourses) {
      if (this.futureCourses[currYear][currTerm].has(dependantcourse)) {
        return true;
      }
    }

    return false;
  }

  haveCourseRequisitesForCourse(course, yearUpperBound, termUpperBound) {
    const termIndexByTerm = {
      winter: 0,
      summer: 1,
      fall: 2,
    };
    // All completed courses by year/term
    const completedCourses = this.otherRequirementCompletion;

    let passedUpperBounds = false;
    for (let year of Object.keys(this.futureCourses)) {
      year = parseInt(year, 10);
      if (year > yearUpperBound || passedUpperBounds) break;
      for (const term of Object.keys(this.futureCourses[year])) {
        // We don't want to take into account courses taken THIS semester for the prerequisites
        // So we don't even want to be on the upperbound
        // e.g: if we curr term is w22, then we will markall courses taken BEFORE w22 as completed
        if (year === yearUpperBound && termIndexByTerm[term] >= termIndexByTerm[termUpperBound]) {
          passedUpperBounds = true;
          break;
        }
        for (const completedCourse of this.futureCourses[year][term]) {
          completedCourses.add(completedCourse);
        }
      }
    }

    const coursePrerequisites = courseInformationByCourseId[course].prereqs;
    for (const coursePrerequisite of coursePrerequisites) {
      if (!completedCourses.has(coursePrerequisite)) {
        return false;
      }
    }

    const courseCorequisites = courseInformationByCourseId[course].coreqs;
    for (const courseCorequisite of courseCorequisites) {
      if (!completedCourses.has(courseCorequisite)
      // Also take into account the year/term of addition
      && !this.futureCourses[yearUpperBound][termUpperBound].has(courseCorequisite)) {
        return false;
      }
    }

    return true;
  }

  addCourseToFuture(course, year, term) {
    if (!Object.hasOwn(this.futureCourses, year)
    || !Object.hasOwn(this.futureCourses[year], term)) {
      this.futureCourses[year] = {
        [term]: new Set(),
        ...this.futureCourses[currYear],
      };
    }

    if (this.otherRequirementCompletion.has(course)) {
      showError('You\'ve completed this course in the past, you cannot remove it');
      return;
    }

    if (!this.haveCourseRequisitesForCourse(course, year, term)) {
      showError(`You don't have the (pre/co)requisites for course ${course} during ${year} ${term} (\nprereqs=${courseInformationByCourseId[course].prereqs}, \ncoreqs=${courseInformationByCourseId[course].coreqs})`);
      return;
    }
    if (!isCourseOffered(course, year, term)) {
      showError(`${course} is only offered during ${getTermOfferings(course)}`);
      return;
    }
    const validSchedules = intersectSchedules(
      this.schedules[year][term],
      getCourseSchedule(course, year, term),
    );
    if (validSchedules.length === 0) {
      showError(`${course} clashes with your current schedule`);
      return;
    }
    this.futureCourses[year][term].add(course);
    document.querySelector(`[course-id=${course}] .circle`).classList.add('future', 'current');
    this.setSchedules(validSchedules, year, term);
  }

  removeCourseFromFuture(removedCourse, year, term) {
    if (!Object.hasOwn(this.futureCourses, year)
    || !Object.hasOwn(this.futureCourses[year], term)) {
      showError('Trying to remove course from year or term that doesn\'t exist for User');
      return;
    }
    if (this.isCourseReqForFutureCourses(removedCourse)) {
      showError('Trying to remove course which serves as a necessary prereq/coreq for other courses');
      return;
    }
    if (!this.futureCourses[year][term].has(removedCourse)) {
      showError('Can only remove planned courses in the term that they were added');
      return;
    }
    this.futureCourses[year][term].delete(removedCourse);
    document.querySelector(`[course-id=${removedCourse}] .circle`).classList.remove('future', 'current');

    // Find which courses are still present
    const courses = Array.from(this.futureCourses[year][term]);
    // Fetch the schedules of these courses
    const schedules = courses.map((course) => getCourseSchedule(course, year, term));
    // Intersect all of them to create all the valid schedules
    const validSchedules = schedules
      .reduce((scheduleA, scheduleB) => intersectSchedules(scheduleA, scheduleB), []);
    this.setSchedules(validSchedules, year, term);
  }

  addDesiredCourse(course) {
    this.desiredCourses.add(course);
    const courseNode = document.querySelector(`[course-id=${course}]`);
    const courseCircle = courseNode.querySelector('.circle');
    courseCircle.classList.add('desireable');
  }

  removeDesiredCourse(course) {
    this.desiredCourses.delete(course);
    const courseNode = document.querySelector(`[course-id=${course}]`);
    const courseCircle = courseNode.querySelector('.circle');
    courseCircle.classList.remove('desireable');
  }
}
const university = 'Concordia University';
const program = 'Computer Science';
export const student = new Student(
  university,
  program,
  undefined,
  undefined,
  new Set([
    'NYA',
    'NYB',
    'NYC',
    'CEGEP103',
    'CEGEP105',
    'MATH203',
    'MATH204',
    'MATH205',
    'CEGEP203',
    'ENCS272',
  ]),
);

// Loads the course schedules for the current term/year after ensuring that
// the student's futureCourses and schedules are adequatly populated
function loadCourseScheduleSafely() {
  if (!Object.hasOwn(student.futureCourses, currYear)
  || !Object.hasOwn(student.futureCourses[currYear], currTerm)) {
    student.futureCourses[currYear] = {
      [currTerm]: new Set(),
      ...student.futureCourses[currYear],
    };
  }
  if (!Object.hasOwn(student.schedules, currYear)
  || !Object.hasOwn(student.schedules[currYear], currTerm)) {
    student.schedules[currYear] = {
      [currTerm]: [],
      ...student.schedules[currYear],
    };
  }

  // Every time we load a course schedule, the term may change, so we handle the term highlighting
  handleTermIcons();

  // Clear all the 'current' classes as we are changing term/year
  // Mark the new term/year classes are 'current'
  document.querySelectorAll('.current').forEach((el) => el.classList.remove('current'));
  student.futureCourses[currYear][currTerm].forEach((courseCode) => {
    document.querySelector(`[course-id=${courseCode}] .circle`).classList.add('current');
  });
  loadCourseSchedules(
    student.schedules[currYear][currTerm],
    Array.from(student.futureCourses[currYear][currTerm]),
  );
}

function formatCourseInformation({ courseName, courseCode, information }) {
  return `
            <span><span class="title">Course Name: </span>${courseName}</span>
            <p><span class="title">Course Code:</span> ${courseCode}</p>
            <p>${information}</p>
    `;
}
function formatProgramInformation(_university, _program) {
  const { creditRequirements } = universityDatabase[_university][_program];
  const formattedCreditRequirements = Object.entries(creditRequirements).map(
    ([electiveName, { completed, need }]) => `
        <div>
            <p>${electiveName}:</p>
            <span style="padding-left:25%"><span style="color:green">Completed</span>/<span style="color:red">Need</span>: ${completed}/${need}</span>
        </div>
        `,
  );
  return `
        <span><span class="title">Program Name:</span> ${program}</span>
        <p><span class="title">Graduation Requirements</span></p>
        <div style="display: flex; flex-direction: column;">${formattedCreditRequirements.join('')}</div>
    `;
}

export default function setCourseInformation(courseInformation) {
  document.getElementById('course-information-content').innerHTML = formatCourseInformation(courseInformation);
}

const termEmojiByTerm = {
  fall: '????',
  summer: '??????',
  winter: '??????',
};

/**
 * Main entry point to the application
 */
function setup() {
  // Sets up the node graph
  setupNodegraph();

  // Sets the default information
  document.getElementById('program-information-content').innerHTML = formatProgramInformation(student.university, student.program);
  document.getElementById('schedule-title').innerText = `${currYear} ${currTerm} ${termEmojiByTerm[currTerm]}`;
  student.otherRequirementCompletion.forEach((course) => {
    document.querySelector(`[course-id=${course}] .circle`).classList.add('completed');
  });
}
setup();

// We create the event listeners for the term-selector buttons
for (const term of ['summer', 'winter', 'fall']) {
  document.querySelector(`button#${term}`).addEventListener('click', () => {
    currTerm = term;
    document.getElementById('schedule-title').innerText = `${currYear} ${currTerm} ${termEmojiByTerm[currTerm]}`;

    // load schedule for currYear and currTerm
    loadCourseScheduleSafely();
  });
}

document.getElementById('year-dropdown').addEventListener('change', (event) => {
  currYear = parseInt(event.target.value, 10);
  document.getElementById('schedule-title').innerText = `${currYear} ${currTerm} ${termEmojiByTerm[currTerm]}`;

  // load schedule for currYear and currTerm
  loadCourseScheduleSafely();
});

// Populate dropdown
const courseListElement = document.querySelector('datalist#courses');
const courseList = Object.keys(courseInformationByCourseId);
courseList.forEach((course) => {
  courseListElement.innerHTML += `<option>${course}</option>`;
});
document.getElementById('search-course').addEventListener('change', (event) => {
  const selectedCourse = event.target.value;
  if (!courseList.includes(selectedCourse)) {
    showError('Course does not exist');
    return;
  }
  scrollCourseIntoView(selectedCourse);
});

// We keep track of the mouse's position so that when we display the popup error message
// we know where to place it
document.getElementById('root-svg').addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});
