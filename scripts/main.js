document.addEventListener('DOMContentLoaded', function () {
    const projectsContainer = document.getElementById('projects-container');
    const certificationsContainer = document.getElementById('certfications-container')
    // Fetch projects from CSV
    fetch('data/projects.csv')
      .then(response => response.text())
      .then(data => {
        const projects = parseCSV(data);
        projects.forEach(project => {
          const projectTile = createProjectTile(project);
          projectsContainer.appendChild(projectTile);
        });
      })
      .catch(error => console.error('Error fetching projects:', error));

    fetch('data/certifications.csv')
      .then(response => response.text())
      .then(data => {
        const certifications = parseCSV(data);
        certifications.forEach(certification => {
          const certificationTile = createCertificateTile(certification);
          certificationsContainer.appendChild(certificationTile);
        });
      })
      .catch(error => console.error('Error fetching projects:', error));
    // Function to parse CSV data
    function parseCSV(csv) {
      const lines = csv.split('\n');
      const projects = [];
      
      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(',');
        
        if (data.length === headers.length) {
          const project = {};
          for (let j = 0; j < headers.length; j++) {
            project[headers[j].trim()] = data[j].trim();
          }
          projects.push(project);
        }
      }
      console.log(projects);
      return projects;
    }
    function displaySentences(string) {
        // Split the string into sentences using a regular expression
        var sentences = string.match(/[^.!?]+[.!?]+/g);
        
                
        // Iterate over each sentence and create a list item for it
        var totalString = "<ul>"
        sentences.forEach(function(sentence) {
            // Create a new list item element
            var li = "<li>"
            // Set the text content of the list item to the current sentence
            console.log(sentence.trim());
            li = li + sentence.trim() + "</li>";
            totalString = totalString + li;
            
            
            
        });
        totalString = totalString + "</ul>" ;
        
        console.log(totalString);
        return totalString;
    }
    
   
    
    // Function to create HTML for project tile
    function createProjectTile(project) {
      const projectTile = document.createElement('div');
      projectTile.classList.add('project-tile');
      if (project['Project Link']=="NA") {
        projectTile.innerHTML = `
        <h3 style="color:orangered">${project['Project Name']}</h3>
        <p><i style="color:orangered">Type: </i> ${project['Type']}</p>
        <p><i style="color:orangered">Tech Stack: </i> ${project['Languages Libs Used']}</p>
        <p>${displaySentences(project['Description'])}</p>
      `;
      } else {
        projectTile.innerHTML = `
        <h3 style="color:orangered">${project['Project Name']}</h3>
        <p><i style="color:orangered">Type: </i> ${project['Type']}</p>
        <p><i style="color:orangered">Tech Stack: </i> ${project['Languages Libs Used']}</p>
        <p>${displaySentences(project['Description'])}</p>
        <a style="text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.5); border-radius: 30px; background-color:  rgb(255, 255, 255,0.2); padding :10px;" href="${project['Project Link']}">View Project  <i class="fa fa-external-link"> </i></a>
      `;
      }
      
      return projectTile;
    }

    function createCertificateTile(certificate) {
        const certificateTile = document.createElement('div');
        certificateTile.classList.add('project-tile');
        if (certificate['Link']=="NA") {
            certificateTile.innerHTML = `
          <h3 style="color:orangered">${certificate['Name']}</h3>
          <h4>${certificate['Date']}</h4>
          
        `;
        } else {
            certificateTile.innerHTML = `
            <h3 style="color:orangered">${certificate['Name']}</h3>
            <h4>${certificate['Date']}</h4>
          <a style="text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.5); border-radius: 30px; background-color:  rgb(255, 255, 255,0.2); padding :10px;" href="${certificate['Link']}">View Certificate  <i class="fa fa-external-link"> </i></a>
        `;
        }
        
        return certificateTile;
      }
  });
  