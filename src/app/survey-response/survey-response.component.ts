import { Component, OnInit, Input } from '@angular/core';
import { Survey } from '../survey.model'
import { FormGroup, Validators, FormBuilder, FormArray, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Question } from '../question.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WeighingMessageComponent } from '../weighing-message/weighing-message.component';


@Component({
  selector: 'app-survey-response',
  templateUrl: './survey-response.component.html',
  styleUrls: ['./survey-response.component.scss']
})
export class SurveyResponseComponent implements OnInit {

  @Input() survey: Survey;
  surveyForm: FormGroup;
  surveyConfigurationId = "";
  companySurveyId = "";
  //console = console;

  constructor(
    private fb: FormBuilder,
    public httpClient: HttpClient,
    private activatedRoute: ActivatedRoute,
    private dialog: MatDialog) {

    this.surveyForm = this.fb.group({
      sectionsResponses: this.fb.array([]),
    })
  }

  ngOnInit(): void {

    this.surveyConfigurationId = this.activatedRoute.snapshot.params.surveyConfigurationId;
    this.companySurveyId = this.activatedRoute.snapshot.params.companySurveyId;

    let i = 0;
    for (let section of this.survey.sections) {

      this.addSection();
      if (section.enabled) {
        for (let question of section.questions) {
          if (question.display === undefined) {
            question.display = true;
          }

          this.addResponse(i, question, section.name);
        }
      }
      i++;
    }
  }

  newSectionResponse(): FormGroup {
    return this.fb.group({
      sectionWeighing: 0,
      questionResponses: this.fb.array([])
    })
  }

  addSection() {
    this.sectionsResponses().push(this.newSectionResponse());
  }

  sectionsResponses(): FormArray {
    return this.surveyForm.get("sectionsResponses") as FormArray
  }

  questionResponses(sectionIndex: number): FormArray {
    return this.sectionsResponses().at(sectionIndex).get("questionResponses") as FormArray
  }


  newQuestionResponse(question: Question, sectionParent: string, sectionIndex: number): FormGroup {

    if (question.parent) {
      for (let child of question.childQuestion) {
        let q = child.questionNumber - 1;
        this.survey.sections[sectionIndex].questions[q].display = false;
      }

    }

    let group = this.fb.group({});

    const sectionName = new FormControl(sectionParent);
    group.addControl('sectionName', sectionName);
    const questionText = new FormControl(question.questionText);
    group.addControl('questionText', questionText);
    const questionNumber = new FormControl(question.questionNumber);
    group.addControl('questionNumber', questionNumber)

    if (question.questionType === 'OPEN') {

      let responseText: FormControl;
      switch (question.responseDataType) {
        case 'INTEGER':
          var pattern = /^\d+$/;
          //responseText = new FormControl('', [Validators.required, Validators.pattern(pattern)]);
          if (question.mandatory) {
            responseText = new FormControl('', Validators.required);
          } else {
            responseText = new FormControl('');
          }

          group.addControl('responseText', responseText);
          break;
        case 'EMAIL': //responseText = new FormControl('', [Validators.required, Validators.email]);
          if (question.mandatory) {
            responseText = new FormControl('', [Validators.required, Validators.email]);
          } else {
            responseText = new FormControl('', Validators.email);
          }
          group.addControl('responseText', responseText);
          break;
        case 'FLOAT':
          var pattern = /^-?\d+\.?\d*$/
          //responseText = new FormControl('', [Validators.required, Validators.pattern(pattern)]);
          if (question.mandatory) {
            responseText = new FormControl('', Validators.required);
          } else {
            responseText = new FormControl('');
          }
          group.addControl('responseText', responseText);
          break;
        default: //responseText = new FormControl('', [Validators.required, Validators.email]);
          if (question.mandatory) {
            responseText = new FormControl('', Validators.required);
          } else {
            responseText = new FormControl('');
          }
          group.addControl('responseText', responseText);
          break;
      }

    } else {
      let responseOption: FormControl;
      if (question.mandatory) {
        responseOption = new FormControl('', Validators.required);
      } else {
        responseOption = new FormControl('');
      }
      group.addControl('responseOption', responseOption);
    }

    return group;
  }

  addResponse(sectionIndex: number, question: Question, sectionName: string) {
    this.questionResponses(sectionIndex).push(this.newQuestionResponse(question, sectionName, sectionIndex));
  }

  onSubmit() {
  }


  selectionChange(event: any): void {
    let selectedIndex = event.previouslySelectedIndex;

    let filledSection = this.survey.sections[selectedIndex];

    if (filledSection.weighing) {

      let value = this.sectionsResponses().at(selectedIndex).get("questionResponses").value;

      //TODO verifica como cambiar este arreglo para que sea dinámico, por el momento tiene 4 elementos por las 4 dimensiones que puede tener la encuesta.
      let sumDimensions: number[] = [0, 0, 0, 0];
      let countDimensions: number[] = [0, 0, 0, 0];

      let totalPoints: number = 0;
      let index = 1;
      for (let val of value) {
        let questionPoints = val.responseOption.value;

        console.log("filledSection: ", filledSection);

        if (filledSection.multiDimensionWeighingMessages) {

          let questionDimension = filledSection.questions[index - 1].dimension;

          sumDimensions[questionDimension - 1] = sumDimensions[questionDimension - 1] + questionPoints;
          countDimensions[questionDimension - 1] = countDimensions[questionDimension - 1] + 1;

        }

        totalPoints += questionPoints;
        index++;
      }

      if (filledSection.weighingAverage) {
        totalPoints = totalPoints / index;

        for (let i = 0; i < sumDimensions.length; i++) {
          sumDimensions[i] = sumDimensions[i] / countDimensions[i];
        }
      }

      this.sectionsResponses().at(selectedIndex).get("sectionWeighing").setValue(totalPoints);

      let allText: string[] = [];

      var showMessage = false;

      for (let weigh of filledSection.weighingMessages) {
        console.log("entro al if");

        if (totalPoints < weigh.limit) {

          allText.push(weigh.text);
          showMessage = true;
          break;
        }
      }

      if (filledSection.multiDimensionWeighingMessages) {
        for (var weighDimension of filledSection.multiDimensionWeighingMessages) {
          for (let i = 0; i < sumDimensions.length; i++) {
            let sum = sumDimensions[i];

            if (weighDimension.dimension === i + 1 && sum < weighDimension.limit) {
              allText.push(weighDimension.text);
              showMessage = true;
              break;
            }
          }
        }
      }

      if (showMessage) {
        this.openDialog(allText);
      }

    }

  }

  openDialog(text: string[]): void {
    this.dialog.open(WeighingMessageComponent, {
      width: '800px',
      data: text
    });
  }

  saveSurvey() {
    let responses = JSON.stringify(this.surveyForm.value);

    let url = "https://portucorazon-api-294002.uc.r.appspot.com/api/v1/survey/response/" + this.surveyConfigurationId;


    const headers = { 'Content-Type': 'application/json' };

    this.httpClient.post(url, responses, { 'headers': headers }).subscribe(
      (response) => {
        console.log(response);
      },
      (error) => {
        console.log(error);
        location.reload();

      }
    )
  }

  radioChange(event: any, section: number, question: number) {

    if (this.survey.sections[section].questions[question].parent) {
      for (let childQuestion of this.survey.sections[section].questions[question].childQuestion) {
        if (event.value.value === childQuestion.responseValue) {
          let i = childQuestion.questionNumber - 1;
          this.survey.sections[section].questions[i].display = true;
        } else {
          let i = childQuestion.questionNumber - 1;
          this.survey.sections[section].questions[i].display = false;
        }
      }
    }
  }


}
